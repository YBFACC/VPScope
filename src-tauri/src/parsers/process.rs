use crate::errors::{AppError, AppErrorCode};
use crate::metrics::snapshot::ProcessInfo;

pub fn parse_ps_output(input: &str) -> Result<Vec<ProcessInfo>, AppError> {
    let mut processes = Vec::new();

    for line in input.lines().skip(1).filter(|line| !line.trim().is_empty()) {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() < 8 {
            return Err(AppError::new(AppErrorCode::ParserFailed, "Invalid ps row"));
        }

        let command = columns[7..].join(" ");
        let name = command
            .split_whitespace()
            .next()
            .and_then(|value| value.rsplit('/').next())
            .unwrap_or("")
            .to_string();

        processes.push(ProcessInfo {
            pid: parse_u32(columns[0], "pid")?,
            ppid: Some(parse_u32(columns[1], "ppid")?),
            user: columns[2].to_string(),
            state: Some(columns[3].to_string()),
            cpu_percent: parse_f64(columns[4], "cpu percent")?,
            memory_percent: Some(parse_f64(columns[5], "memory percent")?),
            memory_bytes: parse_rss_kb(columns[6])?,
            command,
            name,
            started_at: None,
        });
    }

    if processes.is_empty() {
        Err(AppError::new(
            AppErrorCode::ParserFailed,
            "No ps rows were found",
        ))
    } else {
        Ok(processes)
    }
}

fn parse_u32(value: &str, field: &str) -> Result<u32, AppError> {
    value.parse::<u32>().map_err(|err| {
        AppError::new(
            AppErrorCode::ParserFailed,
            format!("Failed to parse ps {field}"),
        )
        .with_detail(err.to_string())
    })
}

fn parse_f64(value: &str, field: &str) -> Result<f64, AppError> {
    value.parse::<f64>().map_err(|err| {
        AppError::new(
            AppErrorCode::ParserFailed,
            format!("Failed to parse ps {field}"),
        )
        .with_detail(err.to_string())
    })
}

fn parse_rss_kb(value: &str) -> Result<u64, AppError> {
    value
        .parse::<u64>()
        .map(|rss_kb| rss_kb * 1024)
        .map_err(|err| {
            AppError::new(AppErrorCode::ParserFailed, "Failed to parse ps rss")
                .with_detail(err.to_string())
        })
}

pub fn filter_sort_limit(
    mut processes: Vec<ProcessInfo>,
    sort_by: &str,
    sort_direction: &str,
    filter: Option<&str>,
    limit: Option<usize>,
) -> Vec<ProcessInfo> {
    if let Some(filter) = filter.map(str::trim).filter(|value| !value.is_empty()) {
        let needle = filter.to_lowercase();
        processes.retain(|process| {
            process.name.to_lowercase().contains(&needle)
                || process.command.to_lowercase().contains(&needle)
                || process.user.to_lowercase().contains(&needle)
        });
    }

    processes.sort_by(|left, right| {
        let ordering = match sort_by {
            "memory" => left.memory_bytes.cmp(&right.memory_bytes),
            "pid" => left.pid.cmp(&right.pid),
            "name" => left.name.cmp(&right.name),
            _ => left.cpu_percent.total_cmp(&right.cpu_percent),
        };
        if sort_direction == "asc" {
            ordering
        } else {
            ordering.reverse()
        }
    });

    if let Some(limit) = limit {
        processes.truncate(limit);
    }

    processes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ps_fixture_with_commands_containing_spaces() {
        let processes =
            parse_ps_output(include_str!("../../tests/fixtures/ps_output.txt")).unwrap();

        assert_eq!(processes.len(), 6);
        assert_eq!(processes[4].name, "node");
        assert!(processes[4]
            .command
            .contains("--very-long-flag used-to-verify-command-with-spaces"));
        assert_eq!(processes[4].memory_bytes, 763_112 * 1024);
    }

    #[test]
    fn filters_sorts_and_limits_processes() {
        let processes =
            parse_ps_output(include_str!("../../tests/fixtures/ps_output.txt")).unwrap();
        let filtered = filter_sort_limit(processes, "cpu", "desc", Some("postgres"), Some(1));

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "postgres");
        assert_eq!(filtered[0].cpu_percent, 7.5);
    }
}
