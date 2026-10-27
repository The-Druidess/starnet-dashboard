from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / "output" / "theseus-quark-review"
original = Image.open(ROOT / "south.png").convert("RGBA")
source = Image.open(ROOT / "south-regeneration-2-source.png").convert("RGBA")
head = source.crop((19, 7, 61, 41))
skin_colors = {
    (205, 139, 103), (155, 86, 29), (176, 111, 71), (162, 101, 58),
    (151, 90, 40), (141, 90, 43), (52, 17, 10), (182, 111, 70),
}
for y in range(head.height):
    for x in range(head.width):
        if head.getpixel((x, y))[:3] not in skin_colors:
            head.putpixel((x, y), (0, 0, 0, 0))
head = head.resize((34, 30), Image.Resampling.NEAREST)
candidate = original.copy()
ImageDraw.Draw(candidate).rectangle((19, 3, 60, 34), fill=(0, 0, 0, 0))
candidate.alpha_composite(head, (23, 4))
assert candidate.crop((0, 35, 80, 80)).tobytes() == original.crop((0, 35, 80, 80)).tobytes()
candidate.save(ROOT / "south-generated-head-2-candidate.png")

sheet = Image.new("RGB", (1440, 720), (75, 79, 88))
draw = ImageDraw.Draw(sheet)
views = [
    ("Previous south", original),
    ("New south candidate", candidate),
    ("Approved southeast", Image.open(ROOT / "south-east.png").convert("RGBA")),
    ("Approved southwest", Image.open(ROOT / "south-west.png").convert("RGBA")),
]
for i, (label, image) in enumerate(views):
    image = image.crop(image.getbbox())
    image = image.resize((image.width * 8, image.height * 8), Image.Resampling.NEAREST)
    sheet.paste(image, (i * 360 + (360 - image.width) // 2, 20), image)
    draw.text((i * 360 + 12, 660), label, fill="white", font_size=20)
sheet.save(ROOT / "south-generation-2-comparison.png")
