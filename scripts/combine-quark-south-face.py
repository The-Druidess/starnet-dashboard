from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / "output" / "theseus-quark-review"
previous = Image.open(ROOT / "south.png").convert("RGBA")
candidate = Image.open(ROOT / "south-generated-head-2-candidate.png").convert("RGBA")
combined = candidate.copy()
palette = {
    (205, 139, 103): (211, 144, 108),
    (155, 86, 29): (162, 88, 25),
    (176, 111, 71): (187, 117, 75),
    (162, 101, 58): (187, 117, 75),
    (151, 90, 40): (162, 88, 25),
    (141, 90, 43): (162, 88, 25),
    (52, 17, 10): (53, 23, 13),
    (182, 111, 70): (187, 117, 75),
}
for y in range(35):
    for x in range(80):
        color = combined.getpixel((x, y))
        if color[3] and color[:3] in palette:
            combined.putpixel((x, y), (*palette[color[:3]], color[3]))

combined.paste(previous.crop((20, 3, 60, 15)), (20, 3))
for y in range(15, 20):
    combined.paste(previous.crop((32, y, 48, y + 1)), (32, y))

draw = ImageDraw.Draw(combined)
draw.rectangle((34, 23, 45, 31), fill=(211, 144, 108, 255))
combined.paste(previous.crop((34, 24, 46, 32)), (34, 24))
pending = [(39, 10)]
connected = set()
while pending:
    x, y = pending.pop()
    if (x, y) in connected or not (0 <= x < 80 and 0 <= y < 35):
        continue
    if not combined.getpixel((x, y))[3]:
        continue
    connected.add((x, y))
    pending.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
for y in range(35):
    for x in range(80):
        if (x, y) not in connected:
            combined.putpixel((x, y), (0, 0, 0, 0))
draw = ImageDraw.Draw(combined)
for y, left, right in ((30, 32, 47), (31, 33, 46)):
    for x in range(20, 60):
        if x < left or x > right:
            combined.putpixel((x, y), (0, 0, 0, 0))
    combined.putpixel((left, y), (187, 117, 75, 255))
    combined.putpixel((right, y), (187, 117, 75, 255))
    for x in range(left + 1, right):
        if not combined.getpixel((x, y))[3]:
            combined.putpixel((x, y), (211, 144, 108, 255))
draw.rectangle((20, 32, 59, 34), fill=(0, 0, 0, 0))
draw.line((34, 32, 45, 32), fill=(211, 144, 108, 255))
draw.point((34, 32), fill=(187, 117, 75, 255))
draw.point((45, 32), fill=(187, 117, 75, 255))
draw.line((36, 33, 43, 33), fill=(187, 117, 75, 255))
draw.line((37, 34, 42, 34), fill=(211, 144, 108, 255))
draw.point((37, 34), fill=(187, 117, 75, 255))
draw.point((42, 34), fill=(187, 117, 75, 255))
assert combined.crop((0, 35, 80, 80)).tobytes() == previous.crop((0, 35, 80, 80)).tobytes()
assert combined.crop((37, 24, 43, 32)).tobytes() == previous.crop((37, 24, 43, 32)).tobytes()
combined.save(ROOT / "south-combined-candidate.png")

sheet = Image.new("RGB", (1440, 720), (75, 79, 88))
draw = ImageDraw.Draw(sheet)
views = [
    ("Previous south", previous),
    ("Combined south", combined),
    ("Approved southeast", Image.open(ROOT / "south-east.png").convert("RGBA")),
    ("Approved southwest", Image.open(ROOT / "south-west.png").convert("RGBA")),
]
for i, (label, image) in enumerate(views):
    image = image.crop(image.getbbox())
    image = image.resize((image.width * 8, image.height * 8), Image.Resampling.NEAREST)
    sheet.paste(image, (i * 360 + (360 - image.width) // 2, 20), image)
    draw.text((i * 360 + 12, 660), label, fill="white", font_size=20)
sheet.save(ROOT / "south-combined-comparison.png")
