#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CpuSample {
    pub id: String,
    pub total: u64,
    pub idle: u64,
}

pub fn parse_proc_stat(input: &str) -> Vec<CpuSample> {
    input
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let id = parts.next()?;
            if !id.starts_with("cpu") {
                return None;
            }
            let values: Vec<u64> = parts.filter_map(|part| part.parse::<u64>().ok()).collect();
            if values.len() < 4 {
                return None;
            }
            let idle = values.get(3).copied().unwrap_or(0) + values.get(4).copied().unwrap_or(0);
            Some(CpuSample {
                id: id.to_string(),
                total: values.iter().sum(),
                idle,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ubuntu_22_proc_stat_fixture() {
        let samples = parse_proc_stat(include_str!("../../tests/fixtures/proc_stat_ubuntu_22.txt"));

        assert_eq!(samples.len(), 5);
        assert_eq!(samples[0].id, "cpu");
        assert_eq!(samples[1].id, "cpu0");
        assert!(samples[0].total > samples[0].idle);
        assert_eq!(samples[1].idle, 32_134);
    }
}
