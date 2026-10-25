//! Razer USB HID control protocol.
//!
//! Every command is a 90-byte feature report (sent with report id 0):
//!
//! | byte  | meaning                         |
//! |-------|---------------------------------|
//! | 0     | status (0 on request)           |
//! | 1     | transaction id                  |
//! | 2..4  | remaining packets (big endian)  |
//! | 4     | protocol type (always 0)        |
//! | 5     | data size                       |
//! | 6     | command class                   |
//! | 7     | command id (bit 7 = read)       |
//! | 8..88 | arguments                       |
//! | 88    | CRC: XOR of bytes 2..88         |
//! | 89    | reserved                        |
//!
//! The layout and command ids follow the community documentation of the
//! OpenRazer project.

use hidapi::HidDevice;
use std::{thread, time::Duration};

pub const REPORT_LEN: usize = 90;

pub const STATUS_BUSY: u8 = 0x01;
pub const STATUS_OK: u8 = 0x02;
pub const STATUS_FAIL: u8 = 0x03;
pub const STATUS_TIMEOUT: u8 = 0x04;
pub const STATUS_UNSUPPORTED: u8 = 0x05;

pub const VARSTORE: u8 = 0x01;

#[derive(Debug, Clone)]
pub struct Report(pub [u8; REPORT_LEN]);

impl Report {
    pub fn new(tx: u8, class: u8, id: u8, size: u8, args: &[u8]) -> Self {
        let mut r = [0u8; REPORT_LEN];
        r[1] = tx;
        r[5] = size;
        r[6] = class;
        r[7] = id;
        let n = args.len().min(80);
        r[8..8 + n].copy_from_slice(&args[..n]);
        r[88] = crc(&r);
        Report(r)
    }

    pub fn status(&self) -> u8 {
        self.0[0]
    }

    pub fn args(&self) -> &[u8] {
        &self.0[8..88]
    }
}

pub fn crc(r: &[u8; REPORT_LEN]) -> u8 {
    r[2..88].iter().fold(0u8, |acc, b| acc ^ b)
}

#[derive(Debug)]
pub enum ProtoError {
    Io(String),
    Busy,
    Failed,
    Timeout,
    Unsupported,
    Mismatch,
}

impl std::fmt::Display for ProtoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProtoError::Io(e) => write!(f, "HID error: {e}"),
            ProtoError::Busy => write!(f, "device busy"),
            ProtoError::Failed => write!(f, "command failed"),
            ProtoError::Timeout => write!(f, "device did not answer (asleep or out of range?)"),
            ProtoError::Unsupported => write!(f, "command not supported by this device"),
            ProtoError::Mismatch => write!(f, "unexpected response"),
        }
    }
}

/// Sends a report and reads the answer, retrying while the device is busy.
pub fn transfer(dev: &HidDevice, req: &Report) -> Result<Report, ProtoError> {
    let mut buf = [0u8; REPORT_LEN + 1];
    buf[1..].copy_from_slice(&req.0);
    dev.send_feature_report(&buf)
        .map_err(|e| ProtoError::Io(e.to_string()))?;

    for attempt in 0..8 {
        thread::sleep(Duration::from_millis(if attempt == 0 { 4 } else { 12 }));
        let mut resp = [0u8; REPORT_LEN + 1];
        let n = dev
            .get_feature_report(&mut resp)
            .map_err(|e| ProtoError::Io(e.to_string()))?;
        // Some backends strip the report id, some keep it.
        let body: &[u8] = if n == REPORT_LEN { &resp[..REPORT_LEN] } else { &resp[1..] };
        let mut out = [0u8; REPORT_LEN];
        out.copy_from_slice(&body[..REPORT_LEN]);
        let out = Report(out);
        match out.status() {
            STATUS_OK => {
                if out.0[6] != req.0[6] || out.0[7] != req.0[7] {
                    return Err(ProtoError::Mismatch);
                }
                return Ok(out);
            }
            STATUS_BUSY | 0x00 => continue,
            STATUS_FAIL => return Err(ProtoError::Failed),
            STATUS_TIMEOUT => return Err(ProtoError::Timeout),
            STATUS_UNSUPPORTED => return Err(ProtoError::Unsupported),
            _ => return Err(ProtoError::Mismatch),
        }
    }
    Err(ProtoError::Busy)
}

// ---------------------------------------------------------------- commands

pub fn get_firmware(tx: u8) -> Report {
    Report::new(tx, 0x00, 0x81, 0x02, &[])
}

pub fn get_serial(tx: u8) -> Report {
    Report::new(tx, 0x00, 0x82, 0x16, &[])
}

pub fn set_dpi(tx: u8, x: u16, y: u16) -> Report {
    let [xh, xl] = x.to_be_bytes();
    let [yh, yl] = y.to_be_bytes();
    Report::new(tx, 0x04, 0x05, 0x07, &[VARSTORE, xh, xl, yh, yl, 0, 0])
}

pub fn get_dpi(tx: u8) -> Report {
    Report::new(tx, 0x04, 0x85, 0x07, &[VARSTORE])
}

/// `active` is 1-based, at most 5 stages.
pub fn set_dpi_stages(tx: u8, active: u8, stages: &[(u16, u16)]) -> Report {
    let stages = &stages[..stages.len().min(5)];
    let mut args = vec![VARSTORE, active.clamp(1, stages.len().max(1) as u8), stages.len() as u8];
    for (i, (x, y)) in stages.iter().enumerate() {
        args.push(i as u8 + 1);
        args.extend_from_slice(&x.to_be_bytes());
        args.extend_from_slice(&y.to_be_bytes());
        args.extend_from_slice(&[0, 0]);
    }
    Report::new(tx, 0x04, 0x06, 0x26, &args)
}

pub fn get_dpi_stages(tx: u8) -> Report {
    Report::new(tx, 0x04, 0x86, 0x26, &[VARSTORE])
}

pub fn polling_code(hz: u32) -> u8 {
    match hz {
        h if h >= 1000 => 0x01,
        h if h >= 500 => 0x02,
        _ => 0x08,
    }
}

pub fn set_polling(tx: u8, hz: u32) -> Report {
    Report::new(tx, 0x00, 0x05, 0x01, &[polling_code(hz)])
}

pub fn get_polling(tx: u8) -> Report {
    Report::new(tx, 0x00, 0x85, 0x01, &[])
}

pub fn hyper_code(hz: u32) -> u8 {
    match hz {
        h if h >= 8000 => 0x01,
        h if h >= 4000 => 0x02,
        h if h >= 2000 => 0x04,
        h if h >= 1000 => 0x08,
        h if h >= 500 => 0x10,
        h if h >= 250 => 0x20,
        _ => 0x40,
    }
}

pub fn set_hyper_polling(tx: u8, hz: u32) -> Report {
    Report::new(tx, 0x00, 0x40, 0x02, &[0x00, hyper_code(hz)])
}

pub fn get_hyper_polling(tx: u8) -> Report {
    Report::new(tx, 0x00, 0xC0, 0x02, &[0x00])
}

pub fn get_battery(tx: u8) -> Report {
    Report::new(tx, 0x07, 0x80, 0x02, &[])
}

pub fn get_charging(tx: u8) -> Report {
    Report::new(tx, 0x07, 0x84, 0x02, &[])
}

/// Seconds before a wireless device sleeps (60..=900).
pub fn set_idle_time(tx: u8, secs: u16) -> Report {
    let [h, l] = secs.clamp(60, 900).to_be_bytes();
    Report::new(tx, 0x07, 0x03, 0x02, &[h, l])
}

pub fn get_idle_time(tx: u8) -> Report {
    Report::new(tx, 0x07, 0x83, 0x02, &[])
}

/// Battery percentage that triggers the low battery warning.
pub fn set_low_battery(tx: u8, percent: u8) -> Report {
    let raw = (percent.clamp(5, 100) as u16 * 255 / 100) as u8;
    Report::new(tx, 0x07, 0x01, 0x01, &[raw])
}

pub fn get_low_battery(tx: u8) -> Report {
    Report::new(tx, 0x07, 0x81, 0x01, &[])
}

// ---------------------------------------------------------------- lighting

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Effect {
    Off,
    Static,
    Breathing,
    Spectrum,
    Wave,
    Reactive,
    Starlight,
}

impl Effect {
    pub fn parse(s: &str) -> Option<Effect> {
        Some(match s {
            "off" => Effect::Off,
            "static" => Effect::Static,
            "breathing" => Effect::Breathing,
            "spectrum" => Effect::Spectrum,
            "wave" => Effect::Wave,
            "reactive" => Effect::Reactive,
            "starlight" => Effect::Starlight,
            _ => return None,
        })
    }
}

pub type Rgb = [u8; 3];

/// Extended matrix effects (most devices from 2018 on).
pub fn ext_effect(tx: u8, led: u8, fx: Effect, colors: &[Rgb], speed: u8, dir: u8) -> Report {
    let c0 = colors.first().copied().unwrap_or([0, 255, 160]);
    let mut a = vec![VARSTORE, led];
    let size = match fx {
        Effect::Off => {
            a.push(0x00);
            0x06
        }
        Effect::Static => {
            a.extend_from_slice(&[0x01, 0, 0, 0x01]);
            a.extend_from_slice(&c0);
            0x09
        }
        Effect::Breathing => match colors.len() {
            0 => {
                a.extend_from_slice(&[0x02, 0x00]);
                0x06
            }
            1 => {
                a.extend_from_slice(&[0x02, 0x01, 0, 0x01]);
                a.extend_from_slice(&c0);
                0x09
            }
            _ => {
                a.extend_from_slice(&[0x02, 0x02, 0, 0x02]);
                a.extend_from_slice(&c0);
                a.extend_from_slice(&colors[1]);
                0x0C
            }
        },
        Effect::Spectrum => {
            a.push(0x03);
            0x06
        }
        Effect::Wave => {
            // speed 1 (fast) .. 4 (slow) mapped to the 0x10..0x60 range
            let s = 0x10 + (speed.clamp(1, 4) - 1) * 0x18;
            a.extend_from_slice(&[0x04, if dir == 2 { 0x02 } else { 0x01 }, s]);
            0x06
        }
        Effect::Reactive => {
            a.extend_from_slice(&[0x05, 0, speed.clamp(1, 4), 0x01]);
            a.extend_from_slice(&c0);
            0x09
        }
        Effect::Starlight => {
            a.extend_from_slice(&[0x07, 0, speed.clamp(1, 3), 0x01]);
            a.extend_from_slice(&c0);
            0x09
        }
    };
    Report::new(tx, 0x0F, 0x02, size, &a)
}

/// Legacy matrix effects (older keyboards and mice).
pub fn std_effect(tx: u8, fx: Effect, colors: &[Rgb], speed: u8, dir: u8) -> Report {
    let c0 = colors.first().copied().unwrap_or([0, 255, 160]);
    let (size, args): (u8, Vec<u8>) = match fx {
        Effect::Off => (1, vec![0x00]),
        Effect::Wave => (2, vec![0x01, if dir == 2 { 0x02 } else { 0x01 }]),
        Effect::Reactive => (5, [vec![0x02, speed.clamp(1, 4)], c0.to_vec()].concat()),
        Effect::Breathing => match colors.len() {
            0 => (1, vec![0x03, 0x03]),
            1 => (8, [vec![0x03, 0x01], c0.to_vec()].concat()),
            _ => (8, [vec![0x03, 0x02], c0.to_vec(), colors[1].to_vec()].concat()),
        },
        Effect::Spectrum => (1, vec![0x04]),
        Effect::Static | Effect::Starlight => (4, [vec![0x06], c0.to_vec()].concat()),
    };
    Report::new(tx, 0x03, 0x0A, size, &args)
}

pub fn ext_brightness(tx: u8, led: u8, value: u8) -> Report {
    Report::new(tx, 0x0F, 0x04, 0x03, &[VARSTORE, led, value])
}

pub fn std_brightness(tx: u8, led: u8, value: u8) -> Report {
    Report::new(tx, 0x03, 0x03, 0x03, &[VARSTORE, led, value])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc_is_xor_of_payload() {
        let r = set_dpi(0x1F, 800, 800);
        let manual = r.0[2..88].iter().fold(0, |a, b| a ^ b);
        assert_eq!(r.0[88], manual);
        assert_eq!(&r.0[5..8], &[0x07, 0x04, 0x05]);
        assert_eq!(&r.0[8..13], &[0x01, 0x03, 0x20, 0x03, 0x20]);
    }

    #[test]
    fn dpi_stages_layout() {
        let r = set_dpi_stages(0x1F, 2, &[(400, 400), (1600, 1600)]);
        assert_eq!(&r.0[8..11], &[0x01, 0x02, 0x02]);
        assert_eq!(&r.0[11..18], &[0x01, 0x01, 0x90, 0x01, 0x90, 0, 0]);
        assert_eq!(r.0[18], 0x02);
    }

    #[test]
    fn static_effect_layout() {
        let r = ext_effect(0x1F, 0x04, Effect::Static, &[[1, 2, 3]], 2, 1);
        assert_eq!(r.0[5], 0x09);
        assert_eq!(&r.0[8..17], &[0x01, 0x04, 0x01, 0, 0, 0x01, 1, 2, 3]);
    }
}
