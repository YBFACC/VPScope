use crate::ssh::client::{DynSshClient, MockSshClient, OpenSshClient};
use std::sync::Arc;

#[derive(Clone)]
pub struct SshSessionPool {
    client: DynSshClient,
}

impl SshSessionPool {
    pub fn new_openssh() -> Self {
        Self {
            client: Arc::new(OpenSshClient::new()),
        }
    }

    pub fn new_mock() -> Self {
        Self {
            client: Arc::new(MockSshClient),
        }
    }

    pub fn client(&self) -> DynSshClient {
        Arc::clone(&self.client)
    }
}
