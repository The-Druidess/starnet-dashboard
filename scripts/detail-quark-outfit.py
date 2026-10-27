from pathlib import Path
import runpy

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "output" / "theseus-quark-review"
OLIVE = (131, 130, 15, 255)
FOLD = (98, 95, 24, 255)
LEATHER = (91, 61, 14, 255)
LEATHER_LIGHT = (151, 98, 42, 255)
LEATHER_DARK = (55, 33, 8, 255)


def detail(image, rear=False):
    original = image.copy()
    cuff = 70 if rear else 71
    for y in range(58, cuff):
        for x in range(30, 50):
            if image.getpixel((x, y)) in (OLIVE, FOLD):
                image.putpixel((x, y), OLIVE)
    for y in range(61, cuff):
        for x in range(31, 49):
            image.putpixel((x, y), (0, 0, 0, 0))
        outer = 32 if y in (61, cuff - 1) else 31
        for left, right in ((outer, 38), (41, 79 - outer)):
            for x in range(left, right + 1):
                image.putpixel((x, y), OLIVE)
            image.putpixel((right if right == 38 else left, y), FOLD)
            if y == cuff - 2:
                for x in range(left + 1, left + 4):
                    image.putpixel((x, y), FOLD)
    for y in range(cuff, 79):
        for x in range(27, 53):
            if original.getpixel((x, y)) not in (LEATHER, LEATHER_LIGHT, LEATHER_DARK):
                continue
            leg_left = 32 if x < 40 else 42
            local_x = x - leg_left
            color = LEATHER
            if local_x == 5 or y == 78:
                color = LEATHER_DARK
            elif local_x == 0 and y < 75:
                color = (74, 34, 28, 255)
            image.putpixel((x, y), color)
    return image


south = Image.open(ROOT / "south-combined-candidate.png").convert("RGBA")
face = south.crop((0, 0, 80, 35)).tobytes()
base = Image.open(ROOT / "south.png").convert("RGBA")
south.paste(base.crop((0, 35, 80, 80)), (0, 35))
southeast = Image.open(ROOT / "south-east.png").convert("RGBA")
south.paste(southeast.crop((39, 41, 46, 54)), (36, 41))
south = detail(south)
assert face == south.crop((0, 0, 80, 35)).tobytes()
south.save(ROOT / "south-combined-candidate.png")
north = Image.open(ROOT / "north.png").convert("RGBA")
detail(north, rear=True).save(ROOT / "north.png")
runpy.run_path(str(Path(__file__).with_name("refine-quark-draft.py")))["previews"]()
