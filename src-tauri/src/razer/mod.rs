pub mod models;
pub mod protocol;

use hidapi::{HidApi, HidDevice};
use models::*;
use protocol::{Effect, ProtoError, Report, Rgb};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::CString;

/// Where we talk to a device once we found the interface that answers.
#[derive(Debug, Clone)]
struct Link {
    path: CString,
    tx: u8,
    firmware: Option<String>,
    serial: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct Zone {
    pub id: u8,
    pub name: &'static str,
}

#[derive(Debug, Serialize, Clone)]
pub struct Caps {
    pub dpi: bool,
    pub stages: bool,
    pub max_dpi: u16,
    pub polling: Vec<u32>,
    pub battery: bool,
    pub idle: bool,
    pub liftoff: bool,
    pub lighting: bool,
    pub brightness: bool,
    pub effects: Vec<&'static str>,
    pub zones: Vec<Zone>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DeviceView {
    pub key: String,
    pub pid: u16,
    pub name: String,
    pub kind: Kind,
    pub wireless: bool,
    pub receiver: bool,
    pub verified: bool,
    pub online: bool,
    pub firmware: Option<String>,
    pub serial: Option<String>,
    pub caps: Caps,
}

#[derive(Debug, Serialize, Default)]
pub struct DeviceState {
    pub dpi: Option<(u16, u16)>,
    pub stages: Option<(u8, Vec<(u16, u16)>)>,
    pub polling: Option<u32>,
    pub battery: Option<u8>,
    pub charging: Option<bool>,
    pub idle: Option<u16>,
    pub low_battery: Option<u8>,
    pub liftoff: Option<u8>,
}

#[derive(Debug, Deserialize)]
pub struct Lighting {
    pub effect: String,
    #[serde(default)]
    pub colors: Vec<Rgb>,
    #[serde(default = "default_speed")]
    pub speed: u8,
    #[serde(default = "default_dir")]
    pub direction: u8,
}

fn default_speed() -> u8 {
    2
}
fn default_dir() -> u8 {
    1
}

pub struct Manager {
    api: Option<HidApi>,
    links: HashMap<u16, Link>,
}

fn key_of(pid: u16) -> String {
    format!("1532:{pid:04x}")
}

fn pid_of(key: &str) -> Result<u16, String> {
    key.strip_prefix("1532:")
        .and_then(|p| u16::from_str_radix(p, 16).ok())
        .ok_or_else(|| format!("bad device key {key}"))
}

fn caps_of(m: &Model) -> Caps {
    let has = |f: u32| m.flags & f != 0;
    let polling = if has(HYPER) {
        vec![125, 500, 1000, 2000, 4000, 8000]
    } else if has(POLL) {
        vec![125, 500, 1000]
    } else {
        vec![]
    };
    let effects = if !has(LIGHT) {
        vec![]
    } else if has(EXT) {
        vec!["static", "breathing", "spectrum", "wave", "reactive", "starlight", "off"]
    } else {
        vec!["static", "breathing", "spectrum", "wave", "reactive", "off"]
    };
    let zones = if has(LIGHT) && has(EXT) {
        m.zones
            .iter()
            .map(|&id| Zone {
                id,
                name: match id {
                    LED_LOGO => "logo",
                    LED_SCROLL => "scroll",
                    LED_BACKLIGHT => "backlight",
                    _ => "all",
                },
            })
            .collect()
    } else if has(LIGHT) {
        vec![Zone { id: LED_BACKLIGHT, name: "all" }]
    } else {
        vec![]
    };
    Caps {
        dpi: has(DPI),
        stages: has(STAGES),
        max_dpi: m.max_dpi,
        polling,
        battery: has(BATT),
        idle: has(IDLE),
        liftoff: has(LIFTOFF),
        lighting: has(LIGHT),
        brightness: has(BRIGHT),
        effects,
        zones,
    }
}

fn firmware_of(r: &Report) -> String {
    format!("v{}.{:02}", r.args()[0], r.args()[1])
}

fn serial_of(r: &Report) -> Option<String> {
    let s: String = r.args()[..22]
        .iter()
        .take_while(|&&b| b != 0)
        .map(|&b| b as char)
        .filter(|c| c.is_ascii_graphic())
        .collect();
    (!s.is_empty()).then_some(s)
}

impl Manager {
    pub fn new() -> Self {
        Manager { api: HidApi::new().ok(), links: HashMap::new() }
    }

    fn api(&mut self) -> Result<&mut HidApi, String> {
        if self.api.is_none() {
            self.api = Some(HidApi::new().map_err(|e| e.to_string())?);
        }
        Ok(self.api.as_mut().unwrap())
    }

    /// Enumerates Razer devices and finds the control interface of new ones.
    pub fn refresh(&mut self) -> Result<Vec<DeviceView>, String> {
        let api = self.api()?;
        api.refresh_devices().map_err(|e| e.to_string())?;

        // group HID interfaces by product id
        let mut found: Vec<(u16, Option<String>, Vec<CString>)> = Vec::new();
        for info in api.device_list().filter(|d| d.vendor_id() == RAZER_VID) {
            let pid = info.product_id();
            let path = info.path().to_owned();
            match found.iter_mut().find(|(p, _, _)| *p == pid) {
                Some((_, _, paths)) => paths.push(path),
                None => found.push((pid, info.product_string().map(str::to_owned), vec![path])),
            }
        }

        self.links.retain(|pid, _| found.iter().any(|(p, _, _)| p == pid));

        let mut out = Vec::new();
        for (pid, product, paths) in found {
            let model = lookup(pid, product.as_deref());
            if !self.links.contains_key(&pid) {
                if let Some(link) = self.probe(&model, &paths) {
                    self.links.insert(pid, link);
                }
            }
            let link = self.links.get(&pid);
            out.push(DeviceView {
                key: key_of(pid),
                pid,
                name: model.name.to_string(),
                kind: model.kind,
                wireless: model.flags & WIRELESS != 0,
                receiver: model.flags & RECEIVER != 0,
                verified: model.flags & UNVERIFIED == 0,
                online: link.is_some(),
                firmware: link.and_then(|l| l.firmware.clone()),
                serial: link.and_then(|l| l.serial.clone()),
                caps: caps_of(&model),
            });
        }
        out.sort_by_key(|d| (d.kind as u8, d.name.clone()));
        Ok(out)
    }

    /// Tries every interface / transaction id until the device answers.
    fn probe(&mut self, model: &Model, paths: &[CString]) -> Option<Link> {
        let api = self.api.as_ref()?;
        let mut txs = vec![model.tx];
        for tx in [0x1F, 0x3F, 0xFF, 0x9F] {
            if !txs.contains(&tx) {
                txs.push(tx);
            }
        }
        for path in paths {
            let Ok(dev) = api.open_path(path) else { continue };
            for &tx in &txs {
                if let Ok(fw) = protocol::transfer(&dev, &protocol::get_firmware(tx)) {
                    let serial = protocol::transfer(&dev, &protocol::get_serial(tx))
                        .ok()
                        .and_then(|r| serial_of(&r));
                    return Some(Link {
                        path: path.clone(),
                        tx,
                        firmware: Some(firmware_of(&fw)),
                        serial,
                    });
                }
            }
        }
        None
    }

    fn open(&mut self, key: &str) -> Result<(HidDevice, u8, Model), String> {
        let pid = pid_of(key)?;
        let link = self
            .links
            .get(&pid)
            .cloned()
            .ok_or("device is not connected or does not answer")?;
        let dev = self.api()?.open_path(&link.path).map_err(|e| e.to_string())?;
        Ok((dev, link.tx, lookup(pid, None)))
    }

    fn run(&mut self, key: &str, build: impl Fn(u8) -> Report) -> Result<Report, String> {
        let (dev, tx, _) = self.open(key)?;
        protocol::transfer(&dev, &build(tx)).map_err(|e: ProtoError| e.to_string())
    }

    pub fn state(&mut self, key: &str) -> Result<DeviceState, String> {
        let (dev, tx, model) = self.open(key)?;
        let caps = caps_of(&model);
        let q = |r: Report| protocol::transfer(&dev, &r).ok();
        let mut s = DeviceState::default();

        if caps.dpi {
            s.dpi = q(protocol::get_dpi(tx)).map(|r| {
                let a = r.args();
                (u16::from_be_bytes([a[1], a[2]]), u16::from_be_bytes([a[3], a[4]]))
            });
        }
        if caps.stages {
            s.stages = q(protocol::get_dpi_stages(tx)).and_then(|r| {
                let a = r.args();
                let count = a[2].min(5) as usize;
                let list: Vec<(u16, u16)> = (0..count)
                    .map(|i| {
                        let o = 3 + i * 7;
                        (u16::from_be_bytes([a[o + 1], a[o + 2]]), u16::from_be_bytes([a[o + 3], a[o + 4]]))
                    })
                    .filter(|(x, _)| *x > 0)
                    .collect();
                (!list.is_empty()).then_some((a[1], list))
            });
        }
        if caps.polling.len() > 3 {
            s.polling = q(protocol::get_hyper_polling(tx)).map(|r| match r.args()[1] {
                0x01 => 8000,
                0x02 => 4000,
                0x04 => 2000,
                0x10 => 500,
                0x20 => 250,
                0x40 => 125,
                _ => 1000,
            });
        }
        if s.polling.is_none() && !caps.polling.is_empty() {
            s.polling = q(protocol::get_polling(tx)).map(|r| match r.args()[0] {
                0x02 => 500,
                0x08 => 125,
                _ => 1000,
            });
        }
        if caps.battery {
            s.battery = q(protocol::get_battery(tx)).map(|r| (r.args()[1] as u16 * 100 / 255) as u8);
            s.charging = q(protocol::get_charging(tx)).map(|r| r.args()[1] == 1);
        }
        if caps.idle {
            s.idle = q(protocol::get_idle_time(tx)).map(|r| u16::from_be_bytes([r.args()[0], r.args()[1]]));
            s.low_battery = q(protocol::get_low_battery(tx)).map(|r| (r.args()[0] as u16 * 100 / 255) as u8);
        }
        if caps.liftoff {
            s.liftoff = q(protocol::get_liftoff(tx)).map(|r| r.args()[2]);
        }
        Ok(s)
    }

    pub fn set_liftoff(&mut self, key: &str, level: u8) -> Result<(), String> {
        let (dev, tx, model) = self.open(key)?;
        if model.flags & LIFTOFF == 0 {
            return Err("lift-off is not supported on this device".into());
        }
        let cur = protocol::transfer(&dev, &protocol::get_liftoff(tx)).map_err(|e| e.to_string())?;
        let a = cur.args();
        // status is unreliable for this command, the new value shows up a moment later
        let _ = protocol::transfer(&dev, &protocol::set_liftoff(tx, level.min(1), a[3], a[4]));
        Ok(())
    }

    pub fn set_dpi(&mut self, key: &str, x: u16, y: u16) -> Result<(), String> {
        self.run(key, |tx| protocol::set_dpi(tx, x.max(100), y.max(100))).map(drop)
    }

    pub fn set_stages(&mut self, key: &str, active: u8, stages: &[(u16, u16)]) -> Result<(), String> {
        self.run(key, |tx| protocol::set_dpi_stages(tx, active, stages)).map(drop)
    }

    pub fn set_polling(&mut self, key: &str, hz: u32) -> Result<(), String> {
        let (dev, tx, model) = self.open(key)?;
        let r = if model.flags & HYPER != 0 {
            protocol::set_hyper_polling(tx, hz)
        } else {
            protocol::set_polling(tx, hz)
        };
        protocol::transfer(&dev, &r).map(drop).map_err(|e| e.to_string())
    }

    pub fn set_lighting(&mut self, key: &str, zone: u8, l: &Lighting, brightness: u8) -> Result<(), String> {
        let fx = Effect::parse(&l.effect).ok_or("unknown effect")?;
        let (dev, tx, model) = self.open(key)?;
        let ext = model.flags & EXT != 0;
        let fx_report = if ext {
            protocol::ext_effect(tx, zone, fx, &l.colors, l.speed, l.direction)
        } else {
            protocol::std_effect(tx, fx, &l.colors, l.speed, l.direction)
        };
        protocol::transfer(&dev, &fx_report).map_err(|e| e.to_string())?;
        if model.flags & BRIGHT != 0 {
            let b = (brightness.min(100) as u16 * 255 / 100) as u8;
            let br = if ext { protocol::ext_brightness(tx, zone, b) } else { protocol::std_brightness(tx, zone, b) };
            // brightness is optional on some firmwares, do not fail the whole call
            let _ = protocol::transfer(&dev, &br);
        }
        Ok(())
    }

    /// Read-only check against real hardware: `cargo test probe_hardware -- --ignored --nocapture`
    #[cfg(test)]
    pub fn debug_paths(&mut self) -> Vec<String> {
        let Ok(api) = self.api() else { return vec![] };
        api.device_list()
            .filter(|d| d.vendor_id() == RAZER_VID)
            .map(|d| format!("{:04x} if={} up={:04x} u={:04x} {}", d.product_id(), d.interface_number(), d.usage_page(), d.usage(), d.path().to_string_lossy()))
            .collect()
    }

    pub fn set_power(&mut self, key: &str, idle: Option<u16>, low_battery: Option<u8>) -> Result<(), String> {
        let (dev, tx, _) = self.open(key)?;
        if let Some(secs) = idle {
            protocol::transfer(&dev, &protocol::set_idle_time(tx, secs)).map_err(|e| e.to_string())?;
        }
        if let Some(p) = low_battery {
            protocol::transfer(&dev, &protocol::set_low_battery(tx, p)).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod hardware {
    use super::*;

    #[test]
    #[ignore]
    fn probe_hardware() {
        let mut m = Manager::new();
        let devices = m.refresh().expect("enumerate");
        for p in m.debug_paths() {
            println!("path {p}");
        }
        for d in &devices {
            println!("\n{} ({}) online={} fw={:?} serial={:?}", d.name, d.key, d.online, d.firmware, d.serial);
            if d.online {
                println!("  state: {:?}", m.state(&d.key));
            }
        }
    }
}

#[cfg(test)]
mod hardware_write {
    use super::*;

    /// Writes back exactly what the device already has, then re-reads it.
    #[test]
    #[ignore]
    fn rewrite_same_values() {
        let mut m = Manager::new();
        for d in m.refresh().unwrap().into_iter().filter(|d| d.online && d.caps.dpi) {
            let s = m.state(&d.key).unwrap();
            let (active, stages) = s.stages.clone().unwrap();
            let (x, y) = s.dpi.unwrap();
            println!("{}: stages {:?}", d.name, m.set_stages(&d.key, active, &stages));
            println!("{}: dpi {:?}", d.name, m.set_dpi(&d.key, x, y));
            println!("{}: polling {:?}", d.name, m.set_polling(&d.key, s.polling.unwrap()));
            println!("{}: power {:?}", d.name, m.set_power(&d.key, s.idle, None));
            println!("{}: after {:?}", d.name, m.state(&d.key));
        }
    }
}

#[cfg(test)]
mod hardware_raw {
    use super::*;

    #[test]
    #[ignore]
    fn dump_stages() {
        let mut m = Manager::new();
        m.refresh().unwrap();
        let (dev, tx, _) = m.open("1532:00c1").unwrap();
        for varstore in [0x00u8, 0x01] {
            let r = protocol::transfer(&dev, &Report::new(tx, 0x04, 0x86, 0x26, &[varstore])).unwrap();
            println!("varstore {varstore}: size={} {:02x?}", r.0[5], &r.0[8..8 + 40]);
        }
    }
}

#[cfg(test)]
mod hardware_scan {
    use super::*;

    /// Reads every "get" command (bit 7 set) of the common classes and saves the answers,
    /// so two snapshots taken around a change in another app can be diffed.
    #[test]
    #[ignore]
    fn scan_gets() {
        let out = std::env::var("SCAN_OUT").expect("SCAN_OUT");
        let mut m = Manager::new();
        m.refresh().unwrap();
        let (dev, tx, _) = m.open("1532:00c1").unwrap();
        let mut lines = Vec::new();
        for class in 0x00u8..=0x10 {
            for id in 0x80u8..=0xBF {
                for arg in [None, Some(0x00u8), Some(0x01u8)] {
                    let args: Vec<u8> = arg.into_iter().collect();
                    if let Ok(r) = protocol::transfer(&dev, &Report::new(tx, class, id, 0x50, &args)) {
                        lines.push(format!("{class:02x} {id:02x} {:?} size={:02x} {:02x?}", arg, r.0[5], &r.0[8..8 + 24]));
                    }
                }
            }
        }
        std::fs::write(&out, lines.join("\n")).unwrap();
        println!("{} answers", lines.len());
    }
}

#[cfg(test)]
mod hardware_liftoff {
    use super::*;

    /// Sets lift-off to LIFTOFF (0 low, 1 medium, 2 high) and reads it back.
    #[test]
    #[ignore]
    fn set_liftoff() {
        let level: u8 = std::env::var("LIFTOFF").unwrap().parse().unwrap();
        let mut m = Manager::new();
        m.refresh().unwrap();
        let (dev, tx, _) = m.open("1532:00c1").unwrap();
        let before = protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x85, 0x05, &[0x01])).unwrap();
        println!("before {:02x?}", &before.0[8..13]);
        let mut args = before.0[8..13].to_vec();
        args[2] = level;
        println!("set {:?}", protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x05, 0x05, &args)).map(|r| r.0[0]));
        let after = protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x85, 0x05, &[0x01])).unwrap();
        println!("after  {:02x?}", &after.0[8..13]);
    }
}

#[cfg(test)]
mod hardware_liftoff_raw {
    use super::*;

    /// Writes LIFTOFF_ARGS (hex bytes) with command 0x0B/0x05 and reads 0x0B/0x85 back.
    #[test]
    #[ignore]
    fn write_liftoff_raw() {
        let args: Vec<u8> = std::env::var("LIFTOFF_ARGS").unwrap().split(',').map(|h| u8::from_str_radix(h.trim(), 16).unwrap()).collect();
        let mut m = Manager::new();
        m.refresh().unwrap();
        let (dev, tx, _) = m.open("1532:00c1").unwrap();
        let r = protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x05, args.len() as u8, &args));
        println!("set {:?}", r.map(|r| r.0[0]));
        let after = protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x85, 0x05, &[0x01])).unwrap();
        println!("after {:02x?}", &after.0[8..13]);
    }
}

#[cfg(test)]
mod hardware_liftoff_cycle {
    use super::*;

    fn read(dev: &HidDevice, tx: u8) -> Vec<u8> {
        protocol::transfer(dev, &Report::new(tx, 0x0B, 0x85, 0x05, &[0x01])).unwrap().0[8..13].to_vec()
    }

    /// High (2) then back to medium (1), waiting for the sensor to apply each.
    #[test]
    #[ignore]
    fn liftoff_high_then_medium() {
        let mut m = Manager::new();
        m.refresh().unwrap();
        let (dev, tx, _) = m.open("1532:00c1").unwrap();
        for level in [2u8, 1] {
            let _ = protocol::transfer(&dev, &Report::new(tx, 0x0B, 0x05, 0x04, &[0x01, level, 0x0c, 0x0b]));
            for i in 0..10 {
                std::thread::sleep(std::time::Duration::from_millis(300));
                let now = read(&dev, tx);
                if now[2] == level || i == 9 {
                    println!("level {level}: {:02x?} after {} ms", now, (i + 1) * 300);
                    break;
                }
            }
        }
    }
}
