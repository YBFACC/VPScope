use crate::errors::{AppError, AppErrorCode};

pub fn parse_loadavg(input: &str) -> Result<[f64; 3], AppError> {
    let mut values = input.split_whitespace().take(3).map(|value| {
        value.parse::<f64>().map_err(|err| {
            AppError::new(AppErrorCode::ParserFailed, "Failed to parse load average")
                .with_detail(err.to_string())
        })
    });

    let one = values.next().ok_or_else(|| {
        AppError::new(AppErrorCode::ParserFailed, "Missing 1 minute load average")
    })??;
    let five = values.next().ok_or_else(|| {
        AppError::new(AppErrorCode::ParserFailed, "Missing 5 minute load average")
    })??;
    let fifteen = values.next().ok_or_else(|| {
        AppError::new(AppErrorCode::ParserFailed, "Missing 15 minute load average")
    })??;

    Ok([one, five, fifteen])
}

pub fn parse_uptime_sec(input: &str) -> Result<u64, AppError> {
    let raw = input
        .split_whitespace()
        .next()
        .ok_or_else(|| AppError::new(AppErrorCode::ParserFailed, "Missing uptime value"))?;
    let uptime = raw.parse::<f64>().map_err(|err| {
        AppError::new(AppErrorCode::ParserFailed, "Failed to parse uptime")
            .with_detail(err.to_string())
    })?;
    Ok(uptime as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_loadavg() {
        assert_eq!(
            parse_loadavg("0.12 0.34 0.56 1/234 5678").unwrap(),
            [0.12, 0.34, 0.56]
        );
    }

    #[test]
    fn parses_uptime() {
        assert_eq!(parse_uptime_sec("12345.67 8910.11").unwrap(), 12345);
    }
}
