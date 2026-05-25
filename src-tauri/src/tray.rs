use crate::{
    config::{TrayItemDisplayMode, TraySettings},
    errors::AppError,
    metrics::snapshot::HostSnapshot,
};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Wry,
};

const TRAY_SHOW_ID: &str = "tray-show";
const TRAY_QUIT_ID: &str = "tray-quit";

pub struct TrayState {
    inner: Mutex<TrayInner>,
}

struct TrayInner {
    app: Option<AppHandle>,
    fallback: Option<TrayItem>,
    items: HashMap<String, TrayItem>,
    snapshots: HashMap<String, HostSnapshot>,
    settings: TraySettings,
}

struct TrayItem {
    tray: TrayIcon<Wry>,
    status_item: MenuItem<Wry>,
    label: String,
    display_mode: TrayItemDisplayMode,
}

impl TrayState {
    pub fn new(settings: TraySettings) -> Self {
        Self {
            inner: Mutex::new(TrayInner {
                app: None,
                fallback: None,
                items: HashMap::new(),
                snapshots: HashMap::new(),
                settings,
            }),
        }
    }

    pub fn attach_app(&self, app: &AppHandle) -> Result<(), AppError> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| AppError::internal("Tray state lock is poisoned"))?;
        inner.app = Some(app.clone());
        inner.rebuild()
    }

    pub fn set_settings(&self, settings: TraySettings) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };

        inner.settings = settings;
        let _ = inner.rebuild();
    }

    pub fn update_snapshot(&self, snapshot: &HostSnapshot) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };

        inner
            .snapshots
            .insert(snapshot.host_id.clone(), snapshot.clone());
        inner.apply_snapshot(snapshot);
    }
}

impl TrayInner {
    fn rebuild(&mut self) -> Result<(), AppError> {
        let Some(app) = self.app.clone() else {
            return Ok(());
        };

        self.remove_current_items(&app);

        if self.settings.items.is_empty() {
            let item = create_tray_item(&app, "vpscope-status", "VS", TrayItemDisplayMode::Text)?;
            item.apply_waiting_display();
            self.fallback = Some(item);
            return Ok(());
        }

        for configured in self.settings.items.clone() {
            let id = format!("vpscope-status-{}", sanitize_tray_id(&configured.host_id));
            let item = create_tray_item(&app, &id, &configured.label, configured.display_mode)?;

            if let Some(snapshot) = self.snapshots.get(&configured.host_id) {
                item.apply_snapshot(snapshot);
            } else {
                item.apply_waiting_display();
            }

            self.items.insert(configured.host_id, item);
        }

        Ok(())
    }

    fn remove_current_items(&mut self, app: &AppHandle) {
        if let Some(item) = self.fallback.take() {
            let _ = app.remove_tray_by_id(item.tray.id());
        }

        for (_, item) in self.items.drain() {
            let _ = app.remove_tray_by_id(item.tray.id());
        }
    }

    fn apply_snapshot(&mut self, snapshot: &HostSnapshot) {
        if let Some(item) = self.items.get(&snapshot.host_id) {
            item.apply_snapshot(snapshot);
            return;
        }

        if self.items.is_empty() {
            if let Some(item) = self.fallback.as_ref() {
                item.apply_snapshot(snapshot);
            }
        }
    }
}

impl TrayItem {
    fn apply_snapshot(&self, snapshot: &HostSnapshot) {
        let memory_percent = percent(snapshot.memory.used_bytes, snapshot.memory.total_bytes);
        let disk_percent = max_disk_percent(snapshot);
        let title = compact_status_title(
            &self.label,
            snapshot.cpu.total_percent,
            memory_percent,
            disk_percent,
            self.display_mode,
        );
        let tooltip = format!(
            "{}\nCPU {}% · MEM {}% · DISK {}%\nLoad {:.2} {:.2} {:.2}",
            snapshot.system.hostname,
            round(snapshot.cpu.total_percent),
            round(memory_percent),
            round(disk_percent),
            snapshot.system.load_avg[0],
            snapshot.system.load_avg[1],
            snapshot.system.load_avg[2]
        );
        let menu_text = format!(
            "{}  CPU {}%  MEM {}%  DISK {}%",
            self.label,
            round(snapshot.cpu.total_percent),
            round(memory_percent),
            round(disk_percent)
        );

        match self.display_mode {
            TrayItemDisplayMode::Text => {
                let _ = self.tray.set_icon(None);
                let _ = self.tray.set_title(Some(title));
            }
            TrayItemDisplayMode::Rings => {
                let _ = self.tray.set_icon_with_as_template(
                    Some(ring_icon(
                        snapshot.cpu.total_percent,
                        memory_percent,
                        disk_percent,
                    )),
                    false,
                );
                let _ = self.tray.set_title(Some(self.label.as_str()));
            }
        }

        let _ = self.tray.set_tooltip(Some(tooltip));
        let _ = self.status_item.set_text(menu_text);
    }

    fn apply_waiting_display(&self) {
        match self.display_mode {
            TrayItemDisplayMode::Text => {
                let _ = self.tray.set_icon(None);
                let _ = self.tray.set_title(Some(format!("{} --", self.label)));
            }
            TrayItemDisplayMode::Rings => {
                let _ = self
                    .tray
                    .set_icon_with_as_template(Some(ring_icon(0.0, 0.0, 0.0)), false);
                let _ = self.tray.set_title(Some(self.label.as_str()));
            }
        }

        let _ = self
            .tray
            .set_tooltip(Some(format!("{} waiting for metrics", self.label)));
        let _ = self
            .status_item
            .set_text(format!("{} waiting for metrics", self.label));
    }
}

pub fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    app.state::<crate::app_state::AppState>()
        .tray_state
        .attach_app(&handle)?;

    Ok(())
}

fn create_tray_item(
    app: &AppHandle,
    id: &str,
    label: &str,
    display_mode: TrayItemDisplayMode,
) -> Result<TrayItem, AppError> {
    let status_item = MenuItem::with_id(
        app,
        format!("{id}-status"),
        format!("{label} waiting for metrics"),
        false,
        None::<&str>,
    )
    .map_err(tray_api_error)?;
    let show_item = MenuItem::with_id(
        app,
        format!("{id}-{TRAY_SHOW_ID}"),
        "Show VPScope",
        true,
        None::<&str>,
    )
    .map_err(tray_api_error)?;
    let quit_item = MenuItem::with_id(
        app,
        format!("{id}-{TRAY_QUIT_ID}"),
        "Quit VPScope",
        true,
        None::<&str>,
    )
    .map_err(tray_api_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(tray_api_error)?;
    let menu = Menu::with_items(app, &[&status_item, &separator, &show_item, &quit_item])
        .map_err(tray_api_error)?;
    let label = sanitize_label(label);
    let initial_icon = matches!(display_mode, TrayItemDisplayMode::Rings)
        .then(|| ring_icon(0.0, 0.0, 0.0))
        .unwrap_or_else(menu_bar_icon);

    let tray = TrayIconBuilder::with_id(id)
        .icon(initial_icon)
        .icon_as_template(matches!(display_mode, TrayItemDisplayMode::Text))
        .title(if matches!(display_mode, TrayItemDisplayMode::Text) {
            format!("{label} --")
        } else {
            label.clone()
        })
        .tooltip(format!("{label} waiting for metrics"))
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();
            if event_id.ends_with(TRAY_SHOW_ID) {
                show_main_window(app);
            } else if event_id.ends_with(TRAY_QUIT_ID) {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)
        .map_err(tray_api_error)?;

    Ok(TrayItem {
        tray,
        status_item,
        label,
        display_mode,
    })
}

fn tray_api_error(error: tauri::Error) -> AppError {
    AppError::internal("Failed to update menu bar status").with_detail(error.to_string())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn percent(used: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        used as f64 / total as f64 * 100.0
    }
}

fn round(value: f64) -> u64 {
    value.round().clamp(0.0, 999.0) as u64
}

fn max_disk_percent(snapshot: &HostSnapshot) -> f64 {
    snapshot
        .disks
        .iter()
        .map(|disk| percent(disk.used_bytes, disk.total_bytes))
        .fold(0.0, f64::max)
}

fn compact_status_title(
    label: &str,
    cpu_percent: f64,
    memory_percent: f64,
    disk_percent: f64,
    display_mode: TrayItemDisplayMode,
) -> String {
    match display_mode {
        TrayItemDisplayMode::Text => format!(
            "{} {} {} {}",
            label,
            round(cpu_percent),
            round(memory_percent),
            round(disk_percent)
        ),
        TrayItemDisplayMode::Rings => label.to_string(),
    }
}

fn sanitize_label(label: &str) -> String {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        "vps".to_string()
    } else {
        trimmed.chars().take(12).collect()
    }
}

fn sanitize_tray_id(id: &str) -> String {
    id.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

fn menu_bar_icon() -> tauri::image::Image<'static> {
    let size = 18_u32;
    let mut rgba = vec![0_u8; (size * size * 4) as usize];
    let center = (size as f64 - 1.0) / 2.0;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 - center;
            let dy = y as f64 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            let offset = ((y * size + x) * 4) as usize;

            if (5.3..=7.1).contains(&distance) {
                rgba[offset + 3] = 235;
            } else if (dx.abs() < 1.2 && dy.abs() < 6.5) || (dy.abs() < 1.2 && dx.abs() < 6.5) {
                rgba[offset + 3] = 215;
            }

            rgba[offset] = 255;
            rgba[offset + 1] = 255;
            rgba[offset + 2] = 255;
        }
    }

    tauri::image::Image::new_owned(rgba, size, size)
}

fn ring_icon(
    cpu_percent: f64,
    memory_percent: f64,
    disk_percent: f64,
) -> tauri::image::Image<'static> {
    let size = 36_u32;
    let mut rgba = vec![0_u8; (size * size * 4) as usize];
    let rings = [
        RingSpec {
            radius: 15.0,
            progress: cpu_percent,
            color: [88, 232, 130],
        },
        RingSpec {
            radius: 11.0,
            progress: memory_percent,
            color: [85, 188, 255],
        },
        RingSpec {
            radius: 7.0,
            progress: disk_percent,
            color: [255, 199, 86],
        },
    ];

    for ring in rings {
        draw_ring_track(&mut rgba, size, ring.radius);
        draw_ring_progress(&mut rgba, size, ring);
    }

    tauri::image::Image::new_owned(rgba, size, size)
}

#[derive(Clone, Copy)]
struct RingSpec {
    radius: f64,
    progress: f64,
    color: [u8; 3],
}

fn draw_ring_track(rgba: &mut [u8], size: u32, radius: f64) {
    draw_ring_segment(rgba, size, radius, 100.0, [62, 68, 76], 78);
}

fn draw_ring_progress(rgba: &mut [u8], size: u32, ring: RingSpec) {
    draw_ring_segment(rgba, size, ring.radius, ring.progress, ring.color, 255);
}

fn draw_ring_segment(
    rgba: &mut [u8],
    size: u32,
    radius: f64,
    progress: f64,
    color: [u8; 3],
    alpha: u8,
) {
    let center = (size as f64 - 1.0) / 2.0;
    let progress = progress.clamp(0.0, 100.0) / 100.0;
    let thickness = 2.8;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 - center;
            let dy = y as f64 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            if (distance - radius).abs() > thickness / 2.0 {
                continue;
            }

            let angle = (dx.atan2(-dy) + std::f64::consts::TAU) % std::f64::consts::TAU;
            if angle / std::f64::consts::TAU > progress {
                continue;
            }

            let edge = 1.0 - ((distance - radius).abs() / (thickness / 2.0)).clamp(0.0, 1.0);
            let pixel_alpha = (alpha as f64 * edge.max(0.28)).round() as u8;
            blend_pixel(rgba, size, x, y, color, pixel_alpha);
        }
    }
}

fn blend_pixel(rgba: &mut [u8], size: u32, x: u32, y: u32, color: [u8; 3], alpha: u8) {
    if alpha == 0 {
        return;
    }

    let offset = ((y * size + x) * 4) as usize;
    let src_alpha = alpha as f64 / 255.0;
    let dst_alpha = rgba[offset + 3] as f64 / 255.0;
    let out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha);

    if out_alpha <= f64::EPSILON {
        return;
    }

    for channel in 0..3 {
        let src = color[channel] as f64 / 255.0;
        let dst = rgba[offset + channel] as f64 / 255.0;
        let out = (src * src_alpha + dst * dst_alpha * (1.0 - src_alpha)) / out_alpha;
        rgba[offset + channel] = (out * 255.0).round() as u8;
    }
    rgba[offset + 3] = (out_alpha * 255.0).round() as u8;
}
