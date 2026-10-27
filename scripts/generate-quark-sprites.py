import json
from math import floor, hypot
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "output" / "theseus-quark-review"
SET = "theseus_quark"
DONOR = ROOT / "frontend" / "assets" / "sprites" / "approved_tom_paris"
SKIN = {(211, 144, 108), (187, 117, 75), (162, 88, 25), (189, 103, 53)}
DONOR_SKIN = {
    (239, 182, 146), (230, 170, 128), (219, 151, 106),
    (201, 141, 102), (181, 116, 88), (148, 88, 63),
    (153, 107, 67), (133, 94, 52),
}
ARM_RECTS = {
    "south": [(58, 70, 65, 94), (79, 70, 86, 94)],
    "south-east": [(56, 71, 64, 95), (79, 72, 85, 91)],
    "east": [(64, 71, 77, 96)],
    "north-east": [(57, 70, 64, 91), (77, 70, 86, 96)],
    "north": [(58, 68, 64, 92), (80, 68, 86, 92)],
    "north-west": [(57, 70, 66, 96), (79, 70, 86, 91)],
    "west": [(67, 71, 80, 93)],
    "south-west": [(59, 72, 65, 91), (80, 71, 88, 95)],
}
DIRECTIONS = ["south", "south-east", "east", "north-east",
              "north", "north-west", "west", "south-west"]
MAX_STRAY_COMPONENT_PIXELS = 7
DESTINATIONS = [
    ROOT / "frontend" / "assets" / "sprites",
    ROOT / "website" / "app" / "assets" / "sprites",
]


def normalized(direction):
    filename = "south-combined-candidate" if direction == "south" else direction
    image = Image.open(REVIEW / f"{filename}.png").convert("RGBA")
    bounds = image.getbbox()
    image = image.crop(bounds)
    width = round(image.width * 76 / image.height)
    image = image.resize((width, 76), Image.Resampling.NEAREST)
    result = Image.new("RGBA", (144, 144))
    result.alpha_composite(image, ((144 - width) // 2, 36))
    return result


def load_donor(name):
    return Image.open(DONOR / name).convert("RGBA")


def hands(image, head_shift):
    pixels = {
        (x, y) for y in range(66 + head_shift, 91) for x in range(40, 104)
        if image.getpixel((x, y))[:3] in DONOR_SKIN and image.getpixel((x, y))[3]
    }
    groups = []
    while pixels:
        group = []
        queue = [pixels.pop()]
        while queue:
            x, y = queue.pop()
            group.append((x, y))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    point = (x + dx, y + dy)
                    if point in pixels:
                        pixels.remove(point)
                        queue.append(point)
        if len(group) >= 2:
            groups.append((sum(x for x, y in group) / len(group),
                           sum(y for x, y in group) / len(group), len(group)))
    if not groups:
        raise ValueError("Donor pose has no identifiable hands")
    return sorted(groups)


def arm_segment(base, rect, source_top, source_bottom, start, end):
    left, _, right, bottom = rect
    texture = Image.new("RGBA", base.size)
    texture.paste(base.crop((left, source_top, right, source_bottom)),
                  (left, source_top))
    for y in range(max(source_top, bottom - 6), source_bottom):
        for x in range(left, right):
            if texture.getpixel((x, y))[:3] in {(131, 130, 15), (98, 95, 24)}:
                texture.putpixel((x, y), (0, 0, 0, 0))
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = hypot(dx, dy)
    if length < 1:
        raise ValueError("Arm segment collapsed")
    ux, uy = dx / length, dy / length
    stretch = (source_bottom - source_top) / length
    cx = (left + right) / 2
    return texture.transform(base.size, Image.Transform.AFFINE, (
        uy, -ux, cx - uy * start[0] + ux * start[1],
        ux * stretch, uy * stretch,
        source_top - stretch * (ux * start[0] + uy * start[1]),
    ), Image.Resampling.NEAREST)


def articulated_arm(base, rect, offset, head_y):
    left, top, right, bottom = rect
    cx = (left + right) / 2
    middle = (top + bottom) // 2
    shoulder = cx, top + head_y
    elbow = cx + offset[0] * 0.35, middle + head_y + offset[1] * 0.25
    wrist = cx + offset[0], bottom + head_y + offset[1]
    arm = arm_segment(base, rect, top, middle + 1, shoulder, elbow)
    arm.alpha_composite(arm_segment(base, rect, middle, bottom, elbow, wrist))
    # Preserve the source texture, but close the newly exposed sleeve cut edge.
    alpha = arm.getchannel("A")
    interior = alpha.filter(ImageFilter.MinFilter(3))
    for y in range(shoulder[1] + 2, 112):
        for x in range(40, 104):
            pixel = arm.getpixel((x, y))
            if pixel[3] and not interior.getpixel((x, y)):
                color = (187, 117, 75) if pixel[:3] in SKIN else (49, 14, 19)
                arm.putpixel((x, y), (*color, 255))
    return arm


def remove_tiny_components(image):
    width, height = image.size
    alpha = image.getchannel("A")
    seen = bytearray(width * height)
    components = []
    for start in range(width * height):
        if not alpha.getpixel((start % width, start // width)) or seen[start]:
            continue
        component = []
        stack = [start]
        seen[start] = 1
        while stack:
            point = stack.pop()
            component.append(point)
            x, y = point % width, point // width
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    neighbor = ny * width + nx
                    if not seen[neighbor] and alpha.getpixel((nx, ny)):
                        seen[neighbor] = 1
                        stack.append(neighbor)
        components.append(component)
    for component in components:
        if len(component) <= MAX_STRAY_COMPONENT_PIXELS:
            for point in component:
                image.putpixel((point % width, point // width), (0, 0, 0, 0))
    return image


def retarget(base, direction, name):
    donor = load_donor(name)
    neutral = load_donor(f"rot_{direction}.png")
    swing_scale = 1.2 if direction in ("east", "west") else 0.9
    head_shift = donor.getbbox()[1] - neutral.getbbox()[1]
    # Register each pose at the neck, not its canvas center (seated side views lean).
    def neck_center(image, shift):
        bounds = image.crop((0, 53 + shift, 144, 56 + shift)).getbbox()
        return (bounds[0] + bounds[2]) / 2

    origin = neck_center(donor, head_shift)
    body_bounds = base.crop((0, 71, 144, 91)).getbbox()
    target_origin = (body_bounds[0] + body_bounds[2]) / 2
    donor_bounds = neutral.crop((0, 58, 144, 79)).getbbox()
    scale_x = (body_bounds[2] - body_bounds[0]) / (donor_bounds[2] - donor_bounds[0])
    def target_row(y):
        if y < 79:
            return round(68 + (y - 54) * 23 / 25)
        return round(91 + (y - 79) * 20 / 32)

    head_y = target_row(54 + head_shift) - 68
    frame = Image.new("RGBA", base.size)
    legs = Image.new("RGBA", donor.size)
    silhouette = Image.new("L", donor.size)
    boots = Image.new("L", donor.size)
    folds = Image.new("L", donor.size)
    for y in range(79, 112):
        for x in range(40, 104):
            pixel = donor.getpixel((x, y))
            if pixel[3] and pixel[:3] not in DONOR_SKIN:
                silhouette.putpixel((x, y), 255)
                if pixel[:3] == (36, 36, 36):
                    folds.putpixel((x, y), 255)
    silhouette = silhouette.filter(ImageFilter.MedianFilter(3))
    # Feet keep a continuous cuff and a seven-pixel boot at Quark's scale;
    # gray highlights in the reference boots must never become olive pixels.
    foot_regions = ([(40, 104)] if direction in ("east", "west") and name.startswith("sit_")
                    else [(40, floor(origin)), (floor(origin), 104)])
    for left, right in foot_regions:
        bounds = silhouette.crop((left, 90, right, 112)).getbbox()
        if not bounds:
            raise ValueError(f"{name}: missing lower-leg silhouette")
        cuff = 90 + bounds[3] - 11
        ImageDraw.Draw(boots).rectangle((left, cuff, right - 1, 111), fill=255)
    folds = folds.filter(ImageFilter.MedianFilter(3))
    for y in range(79, 112):
        for x in range(40, 104):
            if not silhouette.getpixel((x, y)):
                continue
            edge = any(not silhouette.getpixel((x + dx, y + dy))
                   for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
            if edge:
                color = (55, 33, 8)
            elif boots.getpixel((x, y)):
                color = (91, 61, 14)
            else:
                color = (98, 95, 24) if folds.getpixel((x, y)) else (131, 130, 15)
            legs.putpixel((x, y), (*color, 255))
    for y in range(79, 112):
        target_y = target_row(y)
        for x in range(40, 104):
            pixel = legs.getpixel((x, y))
            if not pixel[3]:
                continue
            left = floor(target_origin + (x - origin) * scale_x + 0.5)
            right = floor(target_origin + (x + 1 - origin) * scale_x + 0.5)
            for target_x in range(left, right):
                frame.putpixel((target_x, target_y), pixel)
    silhouette = frame.getchannel("A")
    interior = silhouette.filter(ImageFilter.MinFilter(3))
    for y in range(95, 112):
        for x in range(40, 104):
            if silhouette.getpixel((x, y)) and not interior.getpixel((x, y)):
                frame.putpixel((x, y), (55, 33, 8, 255))
    torso = base.copy()
    draw = ImageDraw.Draw(torso)
    draw.rectangle((0, 91, 143, 143), fill=(0, 0, 0, 0))
    rects = ARM_RECTS[direction]
    if len(rects) == 2:
        for left, top, right, bottom in rects:
            draw.rectangle((left, top, right - 1, bottom - 1), fill=(0, 0, 0, 0))
    back_console = direction == "north" and not name.startswith("walk_")
    if not back_console:
        neutral_hands = hands(neutral, 0)
        pose_hands = hands(donor, head_shift)
    arms = []
    far_arm = None
    if len(rects) == 1:
        near_hand = max(pose_hands, key=lambda p: p[2])
        other_hands = [hand for hand in pose_hands if hand != near_hand]
        if other_hands:
            far_hand = max(other_hands, key=lambda p: p[2])
            rect = rects[0]
            offset = (target_origin + (far_hand[0] - origin) * swing_scale - (rect[0] + rect[2]) / 2,
                      target_row(far_hand[1]) - rect[3] - head_y)
            far_arm = articulated_arm(base, rect, offset, head_y)
    for index, rect in enumerate(rects):
        if back_console:
            phase = int(name.rsplit("_", 1)[1].split(".")[0]) if name.startswith("type_") else 0
            # The reference's rear console poses hide the hands behind the desk.
            offset = ((6 if index == 0 else -6), -12 + (0, -1, 0, 1)[(phase + index) % 4])
        else:
            if len(rects) == 1:
                reference_hand = max(neutral_hands, key=lambda p: p[2])
                pose_hand = max(pose_hands, key=lambda p: p[2])
            else:
                reference_hand = neutral_hands[0 if index == 0 else -1]
                pose_hand = pose_hands[0 if index == 0 else -1]
            offset = ((pose_hand[0] - origin - reference_hand[0] + neck_center(neutral, 0)) * swing_scale,
                      (pose_hand[1] - reference_hand[1] - head_shift) * 0.8)
        arms.append(articulated_arm(base, rect, offset, head_y))
    if far_arm is not None:
        frame.alpha_composite(far_arm)
    frame.alpha_composite(torso, (0, head_y))
    for arm in arms:
        frame.alpha_composite(arm)
    return remove_tiny_components(frame)


def main():
    tracks = {}
    frames = {}
    for direction in DIRECTIONS:
        base = normalized(direction)
        name = f"rot_{direction}.png"
        frames[name] = base
        tracks[f"{SET}.rot.{direction}"] = [f"{SET}/{name}"]
        names = []
        for index in range(6):
            frame = retarget(base, direction, f"walk_{direction}_{index}.png")
            name = f"walk_{direction}_{index}.png"
            frames[name] = frame
            names.append(f"{SET}/{name}")
        tracks[f"{SET}.walk.{direction}"] = names
    for direction in ("south", "east", "north", "west"):
        name = f"sit_{direction}.png"
        frames[name] = retarget(normalized(direction), direction, name)
        tracks[f"{SET}.sit.{direction}"] = [f"{SET}/{name}"]
    tracks[f"{SET}.type.north"] = []
    for index in range(4):
        name = f"type_north_{index}.png"
        frames[name] = retarget(normalized("north"), "north", name)
        tracks[f"{SET}.type.north"].append(f"{SET}/{name}")
    for destination in DESTINATIONS:
        folder = destination / SET
        folder.mkdir(exist_ok=True)
        for name, image in frames.items():
            image.save(folder / name)
        manifest_path = destination / "manifest.json"
        previous_manifest = manifest_path.read_text()
        manifest = json.loads(previous_manifest)
        manifest["sprites"].update(tracks)
        serialized = json.dumps(manifest, indent=2) + "\n"
        if previous_manifest != serialized:
            manifest_path.write_text(serialized)
    preview = []
    for index in range(6):
        image = frames[f"walk_south_{index}.png"].resize((432, 432), Image.Resampling.NEAREST)
        background = Image.new("RGBA", image.size, (75, 79, 88, 255))
        background.alpha_composite(image)
        preview.append(background.convert("RGB"))
    preview[0].save(REVIEW / "walk-preview.gif", save_all=True,
                    append_images=preview[1:], duration=140, loop=0)
    sheet = Image.new("RGBA", (6 * 288, 4 * 288), (75, 79, 88, 255))
    rows = [
        [f"walk_south_{i}.png" for i in range(6)],
        [f"walk_east_{i}.png" for i in range(6)],
        [f"sit_{d}.png" for d in ("south", "east", "north", "west")],
        [f"type_north_{i}.png" for i in range(4)],
    ]
    for y, row in enumerate(rows):
        for x, name in enumerate(row):
            tile = frames[name].resize((288, 288), Image.Resampling.NEAREST)
            sheet.alpha_composite(tile, (x * 288, y * 288))
            ImageDraw.Draw(sheet).text((x * 288 + 8, y * 288 + 8), name, fill="white")
    sheet.save(REVIEW / "animation-review.png")
    motion_preview = []
    labels = DIRECTIONS + ["sit_south", "sit_east", "sit_north", "sit_west", "typing"]
    for index in range(12):
        canvas = Image.new("RGBA", (5 * 240, 3 * 240), (75, 79, 88, 255))
        for cell, label in enumerate(labels):
            if label in DIRECTIONS:
                name = f"walk_{label}_{index % 6}.png"
            elif label == "typing":
                name = f"type_north_{index % 4}.png"
            else:
                name = f"{label}.png"
            x, y = cell % 5 * 240, cell // 5 * 240
            tile = frames[name].crop((32, 28, 112, 116)).resize((200, 220), Image.Resampling.NEAREST)
            canvas.alpha_composite(tile, (x + 20, y + 20))
            ImageDraw.Draw(canvas).text((x + 8, y + 8), label, fill="white")
        motion_preview.append(canvas.convert("RGB"))
    motion_preview[0].save(REVIEW / "animation-preview.gif", save_all=True,
                           append_images=motion_preview[1:], duration=120, loop=0, disposal=2)
    print(f"Generated {len(frames)} Quark frames across {len(tracks)} tracks in both apps.")


if __name__ == "__main__":
    main()
