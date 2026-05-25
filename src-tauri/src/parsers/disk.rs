use crate::{
    errors::{AppError, AppErrorCode},
    metrics::snapshot::DiskInfo,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiskIoCounters {
    pub device: String,
    pub read_bytes: u64,
    pub write_bytes: u64,
}

pub fn parse_df_p(input: &str) -> Result<Vec<DiskInfo>, AppError> {
    let mut disks = Vec::new();

    for line in input.lines().skip(1).filter(|line| !line.trim().is_empty()) {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() < 6 {
            return Err(AppError::new(
                AppErrorCode::ParserFailed,
                "Invalid df -P row",
            ));
        }

        disks.push(DiskInfo {
            fs: columns[0].to_string(),
            total_bytes: parse_1024_blocks(columns[1])?,
            used_bytes: parse_1024_blocks(columns[2])?,
            mount: columns[5..].join(" "),
            read_bytes_per_sec: None,
            write_bytes_per_sec: None,
        });
    }

    if disks.is_empty() {
        Err(AppError::new(
            AppErrorCode::ParserFailed,
            "No df -P rows were found",
        ))
    } else {
        Ok(disks)
    }
}

pub fn parse_diskstats(input: &str) -> Result<Vec<DiskIoCounters>, AppError> {
    let mut counters = Vec::new();

    for line in input.lines().filter(|line| !line.trim().is_empty()) {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() < 10 {
            return Err(AppError::new(
                AppErrorCode::ParserFailed,
                "Invalid /proc/diskstats row",
            ));
        }

        counters.push(DiskIoCounters {
            device: columns[2].to_string(),
            read_bytes: parse_sectors(columns[5], columns[2], "read sectors")?,
            write_bytes: parse_sectors(columns[9], columns[2], "written sectors")?,
        });
    }

    if counters.is_empty() {
        Err(AppError::new(
            AppErrorCode::ParserFailed,
            "No diskstats rows were found",
        ))
    } else {
        Ok(counters)
    }
}

fn parse_1024_blocks(value: &str) -> Result<u64, AppError> {
    value
        .parse::<u64>()
        .map(|blocks| blocks * 1024)
        .map_err(|err| {
            AppError::new(
                AppErrorCode::ParserFailed,
                "Failed to parse df 1024-block value",
            )
            .with_detail(err.to_string())
        })
}

fn parse_sectors(value: &str, device: &str, field: &str) -> Result<u64, AppError> {
    value
        .parse::<u64>()
        .map(|sectors| sectors * 512)
        .map_err(|err| {
            AppError::new(
                AppErrorCode::ParserFailed,
                format!("Failed to parse diskstats {field} for {device}"),
            )
            .with_detail(err.to_string())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_df_p_fixture_with_long_mount_path() {
        let disks = parse_df_p(include_str!("../../tests/fixtures/df_p.txt")).unwrap();

        assert_eq!(disks.len(), 4);
        assert_eq!(disks[0].mount, "/");
        assert_eq!(disks[0].total_bytes, 82_022_488 * 1024);
        assert!(disks.iter().any(|disk| disk.mount
            == "/mnt/object-sync/very/long/mount/path/that/should/not/stretch/the/disk/panel"));
    }

    #[test]
    fn parses_diskstats_sector_counters_as_bytes() {
        let disks =
            parse_diskstats(" 253       0 vda 1024 0 2048 12 256 0 512 8 0 20 20\n").unwrap();

        assert_eq!(disks[0].device, "vda");
        assert_eq!(disks[0].read_bytes, 2048 * 512);
        assert_eq!(disks[0].write_bytes, 512 * 512);
    }
}
