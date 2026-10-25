//! Known Razer devices (vendor id 0x1532).
//!
//! Product ids, transaction ids and LED ids follow the community research of
//! the OpenRazer project. Devices missing from this table are still detected
//! and get capabilities guessed from their product id range.
//! Found a wrong entry? Please open a pull request.

use serde::Serialize;
use std::borrow::Cow;

pub const RAZER_VID: u16 = 0x1532;

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Mouse,
    Keyboard,
    Keypad,
    Mousepad,
    Headset,
    Dock,
    Other,
}

// capability flags
pub const DPI: u32 = 1 << 0;
pub const STAGES: u32 = 1 << 1;
pub const POLL: u32 = 1 << 2;
pub const HYPER: u32 = 1 << 3;
pub const BATT: u32 = 1 << 4;
pub const IDLE: u32 = 1 << 5;
pub const LIGHT: u32 = 1 << 6;
pub const EXT: u32 = 1 << 7;
pub const WIRELESS: u32 = 1 << 8;
pub const RECEIVER: u32 = 1 << 9;
pub const BRIGHT: u32 = 1 << 10;
pub const UNVERIFIED: u32 = 1 << 11;
pub const LIFTOFF: u32 = 1 << 12;
pub const DONGLE_LED: u32 = 1 << 13;
pub const DYNSENS: u32 = 1 << 14;
pub const REMAP: u32 = 1 << 15;

// LED ids
pub const LED_ALL: u8 = 0x00;
pub const LED_SCROLL: u8 = 0x01;
pub const LED_LOGO: u8 = 0x04;
pub const LED_BACKLIGHT: u8 = 0x05;

#[derive(Debug, Clone)]
pub struct Model {
    pub pid: u16,
    pub name: Cow<'static, str>,
    pub kind: Kind,
    pub tx: u8,
    pub max_dpi: u16,
    pub flags: u32,
    pub zones: &'static [u8],
}

const M_WIRED: u32 = DPI | STAGES | POLL;
const M_LIGHT: u32 = LIGHT | EXT | BRIGHT;
const M_WIRELESS: u32 = M_WIRED | BATT | IDLE | WIRELESS;
const M_STD_LIGHT: u32 = LIGHT | BRIGHT;
const KB: u32 = LIGHT | EXT | BRIGHT;

const LOGO: &[u8] = &[LED_LOGO];
const LOGO_SCROLL: &[u8] = &[LED_LOGO, LED_SCROLL];
const BACKLIGHT: &[u8] = &[LED_BACKLIGHT];
const ALL: &[u8] = &[LED_ALL];
const NONE: &[u8] = &[];

macro_rules! m {
    ($pid:expr, $name:expr, $kind:ident, $tx:expr, $dpi:expr, $flags:expr, $zones:expr) => {
        Model { pid: $pid, name: Cow::Borrowed($name), kind: Kind::$kind, tx: $tx, max_dpi: $dpi, flags: $flags, zones: $zones }
    };
}

pub static MODELS: &[Model] = &[
    // ---------------------------------------------------------- mice
    m!(0x0043, "DeathAdder Chroma", Mouse, 0xFF, 10000, M_WIRED | M_STD_LIGHT, NONE),
    m!(0x005C, "DeathAdder Elite", Mouse, 0xFF, 16000, M_WIRED | M_STD_LIGHT, NONE),
    m!(0x0064, "Basilisk", Mouse, 0xFF, 16000, M_WIRED | M_STD_LIGHT, NONE),
    m!(0x0067, "Naga Trinity", Mouse, 0xFF, 16000, M_WIRED | M_LIGHT, LOGO_SCROLL),
    m!(0x0078, "Viper", Mouse, 0x1F, 16000, M_WIRED | M_LIGHT, LOGO),
    m!(0x007A, "Viper Ultimate (Wired)", Mouse, 0x1F, 20000, M_WIRELESS | M_LIGHT, LOGO),
    m!(0x007B, "Viper Ultimate", Mouse, 0x1F, 20000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO),
    m!(0x007C, "DeathAdder V2 Pro (Wired)", Mouse, 0x3F, 20000, M_WIRELESS | M_LIGHT, LOGO),
    m!(0x007D, "DeathAdder V2 Pro", Mouse, 0x3F, 20000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO),
    m!(0x0083, "Basilisk X HyperSpeed", Mouse, 0x1F, 16000, M_WIRELESS | RECEIVER, NONE),
    m!(0x0084, "DeathAdder V2", Mouse, 0x3F, 20000, M_WIRED | M_LIGHT, LOGO_SCROLL),
    m!(0x0085, "Basilisk V2", Mouse, 0x1F, 20000, M_WIRED | M_LIGHT, LOGO_SCROLL),
    m!(0x0086, "Basilisk Ultimate (Wired)", Mouse, 0x1F, 20000, M_WIRELESS | M_LIGHT, LOGO_SCROLL),
    m!(0x0088, "Basilisk Ultimate", Mouse, 0x1F, 20000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO_SCROLL),
    m!(0x008A, "Viper Mini", Mouse, 0x1F, 8500, M_WIRED | M_LIGHT, LOGO),
    m!(0x008C, "DeathAdder V2 Mini", Mouse, 0x3F, 8500, M_WIRED | M_LIGHT, LOGO),
    m!(0x008F, "Naga Pro (Wired)", Mouse, 0x1F, 20000, M_WIRELESS | M_LIGHT, LOGO_SCROLL),
    m!(0x0090, "Naga Pro", Mouse, 0x1F, 20000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO_SCROLL),
    m!(0x0091, "Viper 8KHz", Mouse, 0x1F, 20000, M_WIRED | HYPER | M_LIGHT, LOGO),
    m!(0x0094, "Orochi V2", Mouse, 0x1F, 18000, M_WIRELESS | RECEIVER, NONE),
    m!(0x0096, "Naga X", Mouse, 0x1F, 18000, M_WIRED | M_LIGHT, LOGO_SCROLL),
    m!(0x0098, "DeathAdder Essential", Mouse, 0x1F, 6400, M_WIRED | M_LIGHT, LOGO),
    m!(0x0099, "Basilisk V3", Mouse, 0x1F, 26000, M_WIRED | M_LIGHT, LOGO_SCROLL),
    m!(0x00A1, "DeathAdder V2 Lite", Mouse, 0x1F, 8500, M_WIRED | M_LIGHT, LOGO),
    m!(0x00A3, "Cobra", Mouse, 0x1F, 8500, M_WIRED | M_LIGHT, LOGO),
    m!(0x00A5, "Viper V2 Pro (Wired)", Mouse, 0x1F, 30000, M_WIRELESS, NONE),
    m!(0x00A6, "Viper V2 Pro", Mouse, 0x1F, 30000, M_WIRELESS | RECEIVER, NONE),
    m!(0x00AA, "Basilisk V3 Pro (Wired)", Mouse, 0x1F, 30000, M_WIRELESS | M_LIGHT, LOGO_SCROLL),
    m!(0x00AB, "Basilisk V3 Pro", Mouse, 0x1F, 30000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO_SCROLL),
    m!(0x00AF, "Cobra Pro (Wired)", Mouse, 0x1F, 30000, M_WIRELESS | M_LIGHT, LOGO_SCROLL),
    m!(0x00B0, "Cobra Pro", Mouse, 0x1F, 30000, M_WIRELESS | RECEIVER | M_LIGHT, LOGO_SCROLL),
    m!(0x00B2, "DeathAdder V3", Mouse, 0x1F, 30000, M_WIRED | HYPER, NONE),
    m!(0x00B6, "DeathAdder V3 Pro (Wired)", Mouse, 0x1F, 30000, M_WIRELESS, NONE),
    m!(0x00B7, "DeathAdder V3 Pro", Mouse, 0x1F, 30000, M_WIRELESS | RECEIVER, NONE),
    m!(0x00C0, "Viper V3 Pro (Wired)", Mouse, 0x1F, 35000, M_WIRELESS | HYPER | LIFTOFF | DYNSENS | REMAP, NONE),
    m!(0x00C1, "Viper V3 Pro", Mouse, 0x1F, 35000, M_WIRELESS | RECEIVER | HYPER | LIFTOFF | DYNSENS | DONGLE_LED | REMAP, NONE),
    // ---------------------------------------------------------- keyboards
    m!(0x0203, "BlackWidow Chroma", Keyboard, 0xFF, 0, M_STD_LIGHT, BACKLIGHT),
    m!(0x021E, "Ornata Chroma", Keyboard, 0xFF, 0, M_STD_LIGHT, BACKLIGHT),
    m!(0x0221, "BlackWidow Chroma V2", Keyboard, 0xFF, 0, M_STD_LIGHT, BACKLIGHT),
    m!(0x0226, "Huntsman Elite", Keyboard, 0xFF, 0, KB, BACKLIGHT),
    m!(0x0227, "Huntsman", Keyboard, 0xFF, 0, KB, BACKLIGHT),
    m!(0x0228, "BlackWidow Elite", Keyboard, 0xFF, 0, KB, BACKLIGHT),
    m!(0x022A, "Cynosa Chroma", Keyboard, 0xFF, 0, KB, BACKLIGHT),
    m!(0x0241, "BlackWidow (2019)", Keyboard, 0xFF, 0, KB, BACKLIGHT),
    m!(0x0243, "Huntsman Tournament Edition", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x024E, "BlackWidow V3", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x0257, "Huntsman Mini", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x025A, "BlackWidow V3 Pro (Wired)", Keyboard, 0x1F, 0, KB | BATT, BACKLIGHT),
    m!(0x025C, "BlackWidow V3 Pro", Keyboard, 0x1F, 0, KB | BATT | WIRELESS | RECEIVER, BACKLIGHT),
    m!(0x025D, "Ornata V2", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x025E, "Cynosa V2", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x0266, "Huntsman V2 Analog", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x026C, "Huntsman V2", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x0282, "Huntsman Mini Analog", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x0287, "BlackWidow V4", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x028D, "BlackWidow V4 Pro", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    m!(0x0293, "BlackWidow V4 X", Keyboard, 0x1F, 0, KB, BACKLIGHT),
    // ---------------------------------------------------------- keypads
    m!(0x0207, "Orbweaver Chroma", Keypad, 0xFF, 0, M_STD_LIGHT, BACKLIGHT),
    m!(0x022B, "Tartarus V2", Keypad, 0xFF, 0, KB, BACKLIGHT),
    m!(0x0244, "Tartarus Pro", Keypad, 0xFF, 0, KB, BACKLIGHT),
    // ---------------------------------------------------------- mousepads
    m!(0x0C00, "Firefly", Mousepad, 0xFF, 0, M_STD_LIGHT, ALL),
    m!(0x0C01, "Goliathus Chroma", Mousepad, 0x1F, 0, KB, ALL),
    m!(0x0C02, "Goliathus Extended Chroma", Mousepad, 0x1F, 0, KB, ALL),
    m!(0x0C04, "Firefly V2", Mousepad, 0x1F, 0, KB, ALL),
    m!(0x0C05, "Strider Chroma", Mousepad, 0x1F, 0, KB, ALL),
    // ---------------------------------------------------------- docks & stands
    m!(0x007E, "Mouse Dock Chroma", Dock, 0x1F, 0, KB, ALL),
    m!(0x00A4, "Mouse Dock Pro", Dock, 0x1F, 0, KB, ALL),
    m!(0x0F08, "Base Station Chroma", Dock, 0x1F, 0, KB, ALL),
    m!(0x0F20, "Base Station V2 Chroma", Dock, 0x1F, 0, KB, ALL),
];

pub fn lookup(pid: u16, product: Option<&str>) -> Model {
    if let Some(m) = MODELS.iter().find(|m| m.pid == pid) {
        return m.clone();
    }
    // Unknown device: guess from the product id range so it is still usable.
    let name = match product {
        Some(p) if !p.trim().is_empty() => p.trim().trim_start_matches("Razer ").to_string(),
        _ => format!("Razer {pid:04X}"),
    };
    let (kind, flags, zones, dpi): (Kind, u32, &'static [u8], u16) = match pid {
        0x0000..=0x01FF => (Kind::Mouse, M_WIRED | M_LIGHT | UNVERIFIED, LOGO, 26000),
        0x0200..=0x02FF => (Kind::Keyboard, KB | UNVERIFIED, BACKLIGHT, 0),
        0x0500..=0x05FF => (Kind::Headset, UNVERIFIED, NONE, 0),
        0x0C00..=0x0CFF => (Kind::Mousepad, KB | UNVERIFIED, ALL, 0),
        0x0F00..=0x0FFF => (Kind::Dock, KB | UNVERIFIED, ALL, 0),
        _ => (Kind::Other, UNVERIFIED, NONE, 0),
    };
    Model { pid, name: Cow::Owned(name), kind, tx: 0x1F, max_dpi: dpi, flags, zones }
}
