use crate::{
    errors::{AppError, AppErrorCode},
    metrics::snapshot::MemoryInfo,
};

pub fn parse_meminfo(input: &str) -> Result<MemoryInfo, AppError> {
    let mut total = None;
    let mut available = None;
    let mut cached = Some(0);
    let mut swap_total = Some(0);
    let mut swap_free = Some(0);

    for line in input.lines() {
        let mut parts = line.split_whitespace();
        let Some(key) = parts.next() else { continue };
        let Some(value) = parts.next() else { continue };
        let bytes = value.parse::<u64>().map_err(|err| {
            AppError::new(AppErrorCode::ParserFailed, "Failed to parse meminfo value")
                .with_detail(err.to_string())
        })? * 1024;
        match key.trim_end_matches(':') {
            "MemTotal" => total = Some(bytes),
            "MemAvailable" => available = Some(bytes),
            "Cached" => cached = Some(bytes),
            "SwapTotal" => swap_total = Some(bytes),
            "SwapFree" => swap_free = Some(bytes),
            _ => {}
        }
    }

    let total_bytes =
        total.ok_or_else(|| AppError::new(AppErrorCode::ParserFailed, "MemTotal is missing"))?;
    let available_bytes = available.unwrap_or(0);
    let swap_total_bytes = swap_total.unwrap_or(0);
    let swap_free_bytes = swap_free.unwrap_or(0);

    Ok(MemoryInfo {
        total_bytes,
        used_bytes: total_bytes.saturating_sub(available_bytes),
        available_bytes,
        cached_bytes: cached.unwrap_or(0),
        swap_total_bytes,
        swap_used_bytes: swap_total_bytes.saturating_sub(swap_free_bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_meminfo_bytes() {
        let mem = parse_meminfo(
            "MemTotal:       1000 kB\nMemAvailable:    250 kB\nCached:          100 kB\nSwapTotal:       400 kB\nSwapFree:        300 kB\n",
        )
        .unwrap();
        assert_eq!(mem.total_bytes, 1_024_000);
        assert_eq!(mem.used_bytes, 768_000);
        assert_eq!(mem.swap_used_bytes, 102_400);
    }

    #[test]
    fn parses_ubuntu_22_meminfo_fixture() {
        let mem = parse_meminfo(include_str!(
            "../../tests/fixtures/proc_meminfo_ubuntu_22.txt"
        ))
        .unwrap();

        assert_eq!(mem.total_bytes, 4_039_124 * 1024);
        assert_eq!(mem.available_bytes, 2_462_028 * 1024);
        assert_eq!(mem.cached_bytes, 1_652_196 * 1024);
        assert_eq!(mem.swap_total_bytes, 2_097_148 * 1024);
        assert_eq!(mem.swap_used_bytes, (2_097_148 - 1_572_864) * 1024);
    }

    #[test]
    fn reports_missing_memtotal_as_parser_error() {
        let err = parse_meminfo("MemAvailable: 42 kB\n").unwrap_err();

        assert_eq!(err.code, "PARSER_FAILED");
        assert!(err.message.contains("MemTotal"));
    }
}
