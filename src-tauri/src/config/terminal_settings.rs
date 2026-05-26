use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TerminalApp {
    TerminalApp,
    Iterm2,
    #[serde(rename = "wezterm")]
    WezTerm,
    Ghostty,
    Alacritty,
    Kitty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSettings {
    pub app: TerminalApp,
}

impl Default for TerminalSettings {
    fn default() -> Self {
        Self {
            app: TerminalApp::TerminalApp,
        }
    }
}
