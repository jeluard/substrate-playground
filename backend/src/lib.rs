#![feature(async_closure, proc_macro_hygiene, decl_macro)]

pub mod api;
pub mod error;
pub mod github;
pub mod kubernetes;
pub mod manager;
pub mod metrics;
pub mod prometheus;
pub mod repository;
pub mod types;
pub mod utils;

use crate::manager::Manager;

pub struct Context {
    pub manager: Manager,
}
