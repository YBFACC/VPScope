use crate::{
    errors::{AppError, AppErrorCode},
    metrics::snapshot::NetworkInfo,
};

pub fn parse_proc_net_dev(input: &str) -> Result<Vec<NetworkInfo>, AppError> {
    let mut interfaces = Vec::new();

    for line in input.lines().filter(|line| line.contains(':')) {
        let Some((iface_raw, counters_raw)) = line.split_once(':') else {
            continue;
        };
        let iface = iface_raw.trim();
        let counters = counters_raw.split_whitespace().collect::<Vec<_>>();

        if counters.len() < 16 {
            return Err(AppError::new(
                AppErrorCode::ParserFailed,
                format!("Not enough /proc/net/dev counters for {iface}"),
            ));
        }

        let rx_total_bytes = parse_u64(counters[0], iface, "rx bytes")?;
        let tx_total_bytes = parse_u64(counters[8], iface, "tx bytes")?;

        interfaces.push(NetworkInfo {
            iface: iface.to_string(),
            rx_bytes_per_sec: 0.0,
            tx_bytes_per_sec: 0.0,
            rx_total_bytes,
            tx_total_bytes,
        });
    }

    if interfaces.is_empty() {
        Err(AppError::new(
            AppErrorCode::ParserFailed,
            "No network interfaces were found",
        ))
    } else {
        Ok(interfaces)
    }
}

fn parse_u64(value: &str, iface: &str, field: &str) -> Result<u64, AppError> {
    value.parse::<u64>().map_err(|err| {
        AppError::new(
            AppErrorCode::ParserFailed,
            format!("Failed to parse {field} for {iface}"),
        )
        .with_detail(err.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multi_interface_fixture_and_keeps_loopback_visible() {
        let interfaces = parse_proc_net_dev(include_str!(
            "../../tests/fixtures/proc_net_dev_multi_iface.txt"
        ))
        .unwrap();

        assert_eq!(interfaces.len(), 4);
        assert!(interfaces.iter().any(|iface| iface.iface == "lo"));
        assert!(interfaces.iter().any(|iface| iface.iface == "eth0"));
        assert_eq!(
            interfaces
                .iter()
                .find(|iface| iface.iface == "eth1")
                .unwrap()
                .tx_total_bytes,
            92_144_124
        );
    }
}
