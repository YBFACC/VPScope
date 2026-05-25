#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KnownHostStatus {
    Match,
    Unknown { fingerprint: String },
    Changed { expected: String, actual: String },
}

#[derive(Debug, Default)]
pub struct KnownHostsVerifier;

impl KnownHostsVerifier {
    pub fn verify_known_mock(&self) -> KnownHostStatus {
        KnownHostStatus::Match
    }
}
