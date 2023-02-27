import dataclasses
import os.path
import paths
import stickies
import typing


@dataclasses.dataclass
class Disk:
    name: str
    domain: str
    stickies_path: typing.List[str] = dataclasses.field(
        default_factory=lambda:
        ["System Folder", "Preferences", "Stickies file"])
    stickies_encoding: str = "mac_roman"
    welcome_sticky_override: stickies.Sticky = None
    sticky_placeholder_overwrite_byte: bytes = b'\x00'

    def path(self) -> str:
        return os.path.join(paths.IMAGES_DIR, self.name)


SYSTEM_10 = Disk(
    name="System 1.0.dsk",
    domain="system1.app",
    # NULL byte does not work in TechText when run on System 1.0, but a
    # non-breaking space does.
    sticky_placeholder_overwrite_byte=b'\xca')

SYSTEM_11 = Disk(
    name="System 1.1.dsk",
    domain="system1.app",
    # NULL byte does not work in TechText when run on System 1.1, but a
    # non-breaking space does.
    sticky_placeholder_overwrite_byte=b'\xca',
)

SYSTEM_608 = Disk(
    name="System 6.0.8 HD.dsk",
    domain="system6.app",
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
    SYSTEM_608,
    SYSTEM_753,
    SYSTEM_753_PPC,
    MAC_OS_81,
    KANJITALK_753,
    MAC_OS_904,
]
