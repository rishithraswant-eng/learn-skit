"""Generate brand assets: opengraph-image.png, apple-icon.png, icon.png, favicon.ico."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil

ROOT = Path(__file__).resolve().parents[1]

def make_icons():
    # 512x512 base icon
    base = Image.new('RGB', (512, 512), '#F6F5FD')
    draw = ImageDraw.Draw(base)
    # Peach blob
    draw.ellipse((66, 72, 446, 443), fill='#F5B69E')
    # Blue circle
    draw.ellipse((124, 119, 290, 285), fill='#8DB9F0')

    # Save icon.png (512x512)
    base.save(ROOT / 'icon.png')
    
    # Save apple-icon.png (180x180)
    apple = base.resize((180, 180), Image.Resampling.LANCZOS)
    apple.save(ROOT / 'apple-icon.png')

    # Save favicon.ico
    base.save(ROOT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    # Copy vector icon.svg
    shutil.copyfile(ROOT / 'icons/app.svg', ROOT / 'icon.svg')

    # Also make sure app/ folder has copies if it exists
    app_dir = ROOT / 'app'
    app_dir.mkdir(parents=True, exist_ok=True)
    base.save(app_dir / 'icon.png')
    apple.save(app_dir / 'apple-icon.png')
    base.save(app_dir / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    shutil.copyfile(ROOT / 'icons/app.svg', app_dir / 'icon.svg')
    print("Base icons created successfully.")

def make_og_image():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), '#1B2440')
    draw = ImageDraw.Draw(img)

    # Subtle gradient background (top to bottom: #202945 to #121626)
    r1, g1, b1 = 0x20, 0x29, 0x45
    r2, g2, b2 = 0x12, 0x16, 0x26
    for y in range(H):
        t = y / H
        r = int(r1 * (1 - t) + r2 * t)
        g = int(g1 * (1 - t) + g2 * t)
        b = int(b1 * (1 - t) + b2 * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Inner subtle frame
    draw.rounded_rectangle((30, 30, W - 30, H - 30), radius=24, outline='#2A365D', width=2)

    # Decorative background glow shapes (pastel blue & peach subtle opacity)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((850, -50, 1250, 350), fill=(141, 185, 240, 20)) # blue glow
    glow_draw.ellipse((-100, 400, 350, 850), fill=(245, 182, 158, 18)) # peach glow
    img.paste(glow, (0, 0), glow)

    # Fonts
    font_bold_huge = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 58)
    font_bold_title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 38)
    font_bold_sub = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 32)
    font_bold_pill = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    font_reg_pill = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)

    # Logo mark (top left: 80, 75)
    draw.ellipse((80, 75, 144, 139), fill='#F5B69E')
    draw.ellipse((96, 91, 128, 123), fill='#8DB9F0')

    # Brand name
    draw.text((165, 87), 'learn-skit', fill='#F6F5FD', font=font_bold_title)

    # Pill next to logo: FAT REVISION
    pill_text = "FAT REVISION"
    bbox = draw.textbbox((0, 0), pill_text, font=font_bold_pill)
    pw = bbox[2] - bbox[0] + 28
    draw.rounded_rectangle((350, 91, 350 + pw, 127), radius=18, fill='#263259', outline='#8DB9F0', width=1)
    draw.text((364, 99), pill_text, fill='#8DB9F0', font=font_bold_pill)

    # H1 Headline: "Revise what the exam actually asks."
    draw.text((80, 215), "Revise what the exam", fill='#FFFFFF', font=font_bold_huge)
    draw.text((80, 288), "actually asks.", fill='#FFFFFF', font=font_bold_huge)

    # Subtitle: "EVS · Quant · Qual"
    draw.text((80, 385), "EVS · Quant · Qual", fill='#F5B69E', font=font_bold_sub)

    # Feature pills along bottom
    features = [
        ("EVS Flashcards", "#8DB9F0"),
        ("Predicted MCQs", "#8DB9F0"),
        ("Quant & Qual Practice", "#8DB9F0"),
        ("6-Min Cheat Sheets", "#F5B69E")
    ]
    x_cur = 80
    y_pills = 475
    for label, col in features:
        t_box = draw.textbbox((0, 0), label, font=font_bold_pill)
        w = t_box[2] - t_box[0] + 36
        draw.rounded_rectangle((x_cur, y_pills, x_cur + w, y_pills + 52), radius=16, fill='#222C4E', outline='#354377', width=1)
        draw.text((x_cur + 18, y_pills + 15), label, fill=col, font=font_bold_pill)
        x_cur += w + 20

    img.save(ROOT / 'opengraph-image.png')
    app_dir = ROOT / 'app'
    app_dir.mkdir(parents=True, exist_ok=True)
    img.save(app_dir / 'opengraph-image.png')
    print("opengraph-image.png (1200x630) created successfully.")

if __name__ == '__main__':
    make_icons()
    make_og_image()
