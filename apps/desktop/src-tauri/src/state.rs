use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

impl AppState {
    pub fn new(connection: Connection) -> Self {
        Self {
            db: Mutex::new(connection),
        }
    }
}
