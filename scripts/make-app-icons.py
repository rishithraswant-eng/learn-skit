"""Export the existing code-native app mark as install icons; no external service."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
for size in (192,512):
    image=Image.new('RGB',(512,512),'#F6F5FD');draw=ImageDraw.Draw(image)
    draw.ellipse((66,72,446,443),fill='#F5B69E');draw.ellipse((124,119,290,285),fill='#8DB9F0')
    image.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f'icons/app-{size}.png')
