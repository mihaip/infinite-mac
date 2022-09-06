from __future__ import annotations

import dataclasses
import datetime
import enum
import struct
import typing


class Font(enum.Enum):
    CHICAGO = 0x0000
    GENEVA = 0x0001
    HELVETICA = 0x0015
    COURIER = 0x0016
    MONACO = 0x0004
    NEW_YORK = 0x0002
    PALATINO = 0x0010
    SYMBOL = 0x0017
    TIMES = 0x0014
    ZAPF_DINGBATS = 0x000D
    OSAKA = 0x4000


class Style(enum.Enum):
    BOLD = 0x01
    ITALIC = 0x02
    UNDERLINE = 0x04
    OUTLINE = 0x08
    SHADOW = 0x10
    CONDENSED = 0x20
    EXTENDED = 0x40


class Color(enum.Enum):
    YELLOW = 0x0000
    BLUE = 0x0001
    GREEN = 0x0002
    PINK = 0x0003
    PURPLE = 0x0004
    GRAY = 0x0005
    BLACK_WHITE = 0xFFFF


# 2082844800 is the number of seconds between the Mac epoch (January 1 1904)
# and the Unix epoch (January 1 1970). See
# http://justsolve.archiveteam.org/wiki/HFS/HFS%2B_timestamp
MAC_EPOCH_OFFSET = 2082844800


@dataclasses.dataclass
class Sticky:
    top: int  # 2 bytes
    left: int  # 2 bytes
    bottom: int  # 2 bytes
    right: int  # 2 bytes
    unknown: int = 0  # 8 bytes
    creation_date: datetime.datetime = datetime.datetime.now()  # 4 bytes
    modification_date: datetime.datetime = datetime.datetime.now()  # 4 bytes
    font: Font = Font.GENEVA  # 2 bytes
    size: int = 9  # 1 byte
    style: typing.Set[Style] = dataclasses.field(default_factory=set)  # 1 byte
    color: Color = Color.YELLOW  # 2 bytes
    text: str = ""  # 2 bytes of length + data

    STRUCT = struct.Struct(">hhhh Q LL HBBH H")

    @staticmethod
    def from_bytes(data: bytes, encoding: str = "mac_roman") -> Sticky:
        (top, left, bottom, right, unknown, creation_date_raw,
         modification_date_raw, font, size, style_raw, color,
         text_length) = Sticky.STRUCT.unpack(data[:32])

        creation_date = datetime.datetime.fromtimestamp(creation_date_raw -
                                                        MAC_EPOCH_OFFSET)
        modification_date = datetime.datetime.fromtimestamp(
            modification_date_raw - MAC_EPOCH_OFFSET)

        style = set()
        for s in Style:
            if style_raw & s.value:
                style.add(Style(s))

        text = data[32:32 + text_length].decode(encoding)
        return Sticky(top, left, bottom, right, unknown, creation_date,
                      modification_date, Font(font), size, style, Color(color),
                      text), 32 + text_length

    def to_bytes(self, encoding: str = "mac_roman") -> bytes:
        creation_date_raw = int(
            self.creation_date.timestamp()) + MAC_EPOCH_OFFSET
        modification_date_raw = int(
            self.modification_date.timestamp()) + MAC_EPOCH_OFFSET

        style_raw = 0
        for s in self.style:
            style_raw |= s.value

        text_raw = self.text.replace("\n", "\r").encode(encoding)
        text_length = len(text_raw)

        return Sticky.STRUCT.pack(
            self.top, self.left, self.bottom, self.right, self.unknown,
            creation_date_raw, modification_date_raw, self.font.value,
            self.size, style_raw, self.color.value, text_length) + text_raw


@dataclasses.dataclass
class StickiesFile:
    header: int = 0x00030003  # 4 bytes
    stickies: typing.List[Sticky] = dataclasses.field(
        default_factory=list)  # 2 bytes of length + data
    STRUCT = struct.Struct(">L H")

    @staticmethod
    def from_bytes(data: bytes, encoding: str = "mac_roman") -> StickiesFile:
        stickies = []
        header, sticky_count = StickiesFile.STRUCT.unpack(data[:6])
        offset = 6
        for i in range(sticky_count):
            sticky, sticky_size = Sticky.from_bytes(data[offset:], encoding)
            stickies.append(sticky)
            offset += sticky_size
        return StickiesFile(header, stickies)

    def to_bytes(self, encoding: str = "mac_roman") -> bytes:
        stickies_raw = b""
        for sticky in self.stickies:
            stickies_raw += sticky.to_bytes(encoding)
        return StickiesFile.STRUCT.pack(self.header, len(
            self.stickies)) + stickies_raw
