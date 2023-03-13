import dataclasses
import os.path
import paths
import stickies
import typing


@dataclasses.dataclass
class Disk:
    name: str
    domain: str = None
    stickies_path: typing.List[str] = dataclasses.field(
        default_factory=lambda:
        ["System Folder", "Preferences", "Stickies file"])
    stickies_encoding: str = "mac_roman"
    welcome_sticky_override: stickies.Sticky = None
    # NULL byte does not work in TechText when run on older versions, but a
    # non-breaking space does, so we allow it to be overridden per-disk.
    sticky_placeholder_overwrite_byte: bytes = b'\x00'

    def path(self) -> str:
        return os.path.join(paths.IMAGES_DIR, self.name)


SYSTEM_10 = Disk(
    name="System 1.0.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_11 = Disk(
    name="System 1.1.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_20 = Disk(
    name="System 2.0.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_21 = Disk(
    name="System 2.1.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_30 = Disk(
    name="System 3.0.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_32 = Disk(
    name="System 3.2.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_33 = Disk(
    name="System 3.3.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_40 = Disk(
    name="System 4.0.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_41 = Disk(
    name="System 4.1.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_50 = Disk(
    name="System 5.0 HD.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_51 = Disk(
    name="System 5.1 HD.dsk",
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_60 = Disk(
    name="System 6.0 HD.dsk",
    domain="system6.app",
)

SYSTEM_602 = Disk(
    name="System 6.0.2 HD.dsk",
    domain="system6.app",
)

SYSTEM_603 = Disk(
    name="System 6.0.3 HD.dsk",
    domain="system6.app",
)

SYSTEM_604 = Disk(
    name="System 6.0.4 HD.dsk",
    domain="system6.app",
)

SYSTEM_605 = Disk(
    name="System 6.0.5 HD.dsk",
    domain="system6.app",
)

SYSTEM_607 = Disk(
    name="System 6.0.7 HD.dsk",
    domain="system6.app",
)

SYSTEM_608 = Disk(
    name="System 6.0.8 HD.dsk",
    domain="system6.app",
)

SYSTEM_70 = Disk(
    name="System 7.0 HD.dsk",
    domain="system7.app",
)

SYSTEM_71 = Disk(
    name="System 7.1 HD.dsk",
    domain="system7.app",
)

SYSTEM_711 = Disk(
    name="System 7.1.1 HD.dsk",
    domain="system7.app",
)

SYSTEM_75 = Disk(
    name="System 7.5 HD.dsk",
    domain="system7.app",
)

SYSTEM_751 = Disk(
    name="System 7.5.1 HD.dsk",
    domain="system7.app",
)

SYSTEM_753 = Disk(
    name="System 7.5.3 HD.dsk",
    domain="system7.app",
)

SYSTEM_753_PPC = Disk(
    name="System 7.5.3 (PPC) HD.dsk",
    domain="system7.app",
)

MAC_OS_81 = Disk(
    name="Mac OS 8.1 HD.dsk",
    domain="macos8.app",
)

JAPANESE_WELCOME_STICKY = stickies.Sticky(
    top=125,
    left=468,
    bottom=180,
    right=660,
    font=stickies.Font.OSAKA,
    size=18,
    style={stickies.Style.BOLD},
    text="Infinite Macintosh へようこそ！",
)

KANJITALK_753 = Disk(
    name="KanjiTalk 7.5.3 HD.dsk",
    domain="kanjitalk7.app",
    # Generate Mojibake of Shift-JIS interpreted as MacRoman, the machfs
    # library always assumes the latter.
    stickies_path=[
        p.encode("shift_jis").decode("mac_roman") for p in [
            "システムフォルダ",
            "初期設定",
            'スティッキーズファイル',
        ]
    ],
    stickies_encoding="shift_jis",
    welcome_sticky_override=JAPANESE_WELCOME_STICKY)

MAC_OS_904 = Disk(
    name="Mac OS 9.0.4 HD.dsk",
    domain="macos9.app",
)

ALL_DISKS = [
    SYSTEM_10,
    SYSTEM_11,
    SYSTEM_20,
    SYSTEM_21,
    SYSTEM_30,
    SYSTEM_32,
    SYSTEM_33,
    SYSTEM_40,
    SYSTEM_41,
    SYSTEM_50,
    SYSTEM_51,
    SYSTEM_60,
    SYSTEM_602,
    SYSTEM_603,
    SYSTEM_604,
    SYSTEM_605,
    SYSTEM_607,
    SYSTEM_608,
    SYSTEM_70,
    SYSTEM_71,
    SYSTEM_711,
    SYSTEM_75,
    SYSTEM_751,
    SYSTEM_753,
    SYSTEM_753_PPC,
    MAC_OS_81,
    KANJITALK_753,
    MAC_OS_904,
]
