from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1] / "output" / "theseus-quark-review"
SKIN = (211, 144, 108, 255)
RIDGE = (187, 117, 75, 255)
DIRECTIONS = [
    "south", "south-east", "east", "north-east",
    "north", "north-west", "west", "south-west",
]


def refine():
    south = Image.open(ROOT / "south.png").convert("RGBA")
    draw = ImageDraw.Draw(south)
    draw.rectangle((20, 3, 59, 34), fill=(0, 0, 0, 0))
    left_edges = [
        34, 32, 31, 30, 29, 28, 28, 27, 27, 27,
        27, 26, 25, 24, 24, 23, 23, 23, 23, 24,
        24, 25, 26, 28, 30, 31, 31, 32, 33, 34, 36,
    ]
    for y, left in enumerate(left_edges, start=4):
        right = 79 - left
        draw.line((left, y, right, y), fill=SKIN)
        south.putpixel((left, y), RIDGE)
        south.putpixel((right, y), RIDGE)
    for x in (39, 40):
        south.putpixel((x, 4), (0, 0, 0, 0))
    south.putpixel((39, 5), RIDGE)
    south.putpixel((40, 5), RIDGE)
    for points in (
        [(31, 10), (32, 8), (35, 7), (38, 9), (38, 12)],
        [(48, 10), (47, 8), (44, 7), (41, 9), (41, 12)],
        [(31, 16), (33, 17), (35, 18), (38, 19), (41, 19),
         (44, 18), (46, 17), (48, 16)],
    ):
        draw.line(points, fill=RIDGE)
    southeast = Image.open(ROOT / "south-east.png").convert("RGBA")
    for y in range(19, 31):
        for x in range(26, 35):
            color = southeast.getpixel((x, y))
            if color[3]:
                for target in ((x - 1, y), (80 - x, y)):
                    if south.getpixel(target)[3]:
                        south.putpixel(target, color)
    brow = [(33, 21), (35, 21), (37, 22), (38, 22)]
    for points in (brow, [(79 - x, y) for x, y in brow]):
        draw.line(points, fill=(162, 88, 25, 255), width=2)
    for source, target in (
        ((38, 24, 40, 26), (35, 24)),
        ((38, 24, 40, 26), (43, 24)),
        ((40, 30, 46, 32), (37, 30)),
    ):
        south.paste(southeast.crop(source), target)
    draw.line([(39, 25), (38, 27), (39, 28), (41, 28), (42, 27), (41, 25)],
              fill=(162, 88, 25, 255))
    draw.line([(35, 27), (34, 28), (34, 30)], fill=RIDGE)
    draw.line([(44, 27), (45, 28), (45, 30)], fill=RIDGE)
    draw.line([(36, 33), (38, 34), (41, 34), (43, 33)], fill=RIDGE)
    for y, left in enumerate(left_edges, start=4):
        for x in range(20, 60):
            if x < left or x > 79 - left:
                south.putpixel((x, y), (0, 0, 0, 0))
    south.save(ROOT / "south.png")

    west = Image.open(ROOT / "west.png").convert("RGBA")
    assert west.getpixel((29, 9)) in ((246, 246, 227, 255), SKIN)
    west.putpixel((29, 9), SKIN)
    west.save(ROOT / "west.png")

    northwest = Image.open(ROOT / "north-west.png").convert("RGBA")
    northeast = ImageOps.mirror(northwest)
    northeast.save(ROOT / "north-east.png")

    north = Image.open(ROOT / "north.png").convert("RGBA")
    draw = ImageDraw.Draw(north)
    draw.rectangle((31, 8, 48, 25), fill=SKIN)
    for y in (11, 17, 23):
        left = [(32, y), (34, y), (35, y - 1), (37, y - 1), (38, y - 2)]
        draw.line(left, fill=RIDGE)
        draw.line([(79 - x, row) for x, row in left], fill=RIDGE)
    draw.rectangle((39, 6, 40, 9), fill=RIDGE)
    for x in (39, 40):
        north.putpixel((x, 4), (0, 0, 0, 0))
        north.putpixel((x, 5), (0, 0, 0, 0))
    north.save(ROOT / "north.png")


def previews():
    for name, cell_width, cell_height, scale, font_size in (
        ("direction-review.png", 240, 260, 2, 14),
        ("direction-review-large.png", 360, 680, 8, 22),
    ):
        sheet = Image.new("RGB", (cell_width * 4, cell_height * 2), (75, 79, 88))
        draw = ImageDraw.Draw(sheet)
        for i, direction in enumerate(DIRECTIONS):
            filename = "south-combined-candidate.png" if direction == "south" else f"{direction}.png"
            image = Image.open(ROOT / filename).convert("RGBA")
            image = image.crop(image.getbbox())
            image = image.resize(
                (image.width * scale, image.height * scale),
                Image.Resampling.NEAREST,
            )
            x = (i % 4) * cell_width + (cell_width - image.width) // 2
            y = (i // 4) * cell_height + (cell_height - 40 - image.height) // 2
            sheet.paste(image, (x, y), image)
            draw.text(
                ((i % 4) * cell_width + 16, (i // 4 + 1) * cell_height - 30),
                direction, fill="white", font_size=font_size,
            )
        sheet.save(ROOT / name)
    south = Image.open(ROOT / "south-combined-candidate.png").convert("RGBA")
    south = south.crop(south.getbbox())
    south = south.resize((south.width * 12, south.height * 12), Image.Resampling.NEAREST)
    background = Image.new("RGBA", south.size, (75, 79, 88, 255))
    background.alpha_composite(south)
    background.convert("RGB").save(ROOT / "south-review-large.png")


if __name__ == "__main__":
    refine()
    previews()
