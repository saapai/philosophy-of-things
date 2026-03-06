#!/usr/bin/env python3
"""Apply painterly filter aesthetics to images.

Usage: python3 painterly.py <input_path> <output_path> <style>
Styles: oil, icm, hybrid
"""

import sys
import cv2
import numpy as np
from pykuwahara import kuwahara


# ── Helpers ──────────────────────────────────────────────

def boost_saturation(img, factor=1.3):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * factor, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def make_gaussian_motion_kernel(size, angle_degrees):
    """Motion blur kernel with Gaussian weighting — mimics real camera
    acceleration/deceleration for natural-looking streaks."""
    sigma = size / 4.0
    kernel = np.zeros((size, size), dtype=np.float32)
    center = size // 2
    angle_rad = np.radians(angle_degrees)

    for i in range(size):
        t = i - center
        x = int(center + t * np.cos(angle_rad))
        y = int(center + t * np.sin(angle_rad))
        if 0 <= x < size and 0 <= y < size:
            kernel[y, x] = np.exp(-0.5 * (t / sigma) ** 2)

    kernel /= kernel.sum()
    return kernel


# ── Oil Painting ─────────────────────────────────────────

def style_oil(img):
    """Rich oil painting: bilateral smoothing → Kuwahara brushstrokes
    → xphoto flattening → saturation boost → detail enhance."""

    # Step 1: Multi-pass bilateral to smooth texture while keeping edges
    smoothed = img.copy()
    for _ in range(4):
        smoothed = cv2.bilateralFilter(smoothed, d=9, sigmaColor=75, sigmaSpace=75)

    # Step 2: Kuwahara for characteristic flat-color brushstroke blocks
    # Use luminance channel to guide region selection (prevents color artifacts)
    lab = cv2.cvtColor(smoothed, cv2.COLOR_BGR2Lab)
    l_channel = cv2.split(lab)[0]
    painted = kuwahara(smoothed, method='gaussian', radius=5, sigma=2.0,
                       image_2d=l_channel)

    # Step 3: xphoto oil painting for additional luminance-based flattening
    try:
        painted = cv2.xphoto.oilPainting(painted, 7, 1)
    except AttributeError:
        pass

    # Step 4: Boost saturation — real oil paintings have rich, vivid color
    painted = boost_saturation(painted, 1.25)

    # Step 5: Detail enhance sharpens edges like palette knife marks
    painted = cv2.detailEnhance(painted, sigma_s=10, sigma_r=0.15)

    return painted


# ── ICM (Intentional Camera Movement) ───────────────────

def style_icm(img):
    """Dreamy ICM: Gaussian-weighted vertical motion blur → soft glow
    blend → saturation boost → CLAHE contrast recovery."""

    # Step 1: Gaussian-weighted directional motion blur (vertical)
    kernel = make_gaussian_motion_kernel(51, angle_degrees=90)
    blurred = cv2.filter2D(img, -1, kernel)

    # Step 2: Dreamy Gaussian glow — distinguishes ICM from plain motion blur
    glow = cv2.GaussianBlur(blurred, (0, 0), sigmaX=25)
    dreamy = cv2.addWeighted(blurred, 0.7, glow, 0.3, 0)

    # Step 3: Boost saturation + slight brightness for ethereal quality
    hsv = cv2.cvtColor(dreamy, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.35, 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.05, 0, 255)
    result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # Step 4: CLAHE contrast recovery — prevents flat/muddy look
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2Lab)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    result = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_Lab2BGR)

    return result


# ── Hybrid (Brushstrokes + Dreamy Blur) ─────────────────

def style_hybrid(img):
    """Frequency-split hybrid: ICM provides dreamy base tone, oil painting
    provides brushstroke texture overlaid on top."""

    # Generate both base effects
    oil = style_oil(img)
    icm = style_icm(img)

    # Extract high-frequency brushstroke texture from oil painting
    oil_blur = cv2.GaussianBlur(oil, (0, 0), sigmaX=15)
    oil_detail = cv2.subtract(oil, oil_blur).astype(np.float32)

    # Use ICM as the dreamy base, overlay brushstroke texture
    base = icm.astype(np.float32)
    hybrid = np.clip(base + oil_detail * 1.5, 0, 255).astype(np.uint8)

    # Final saturation tie-together
    hybrid = boost_saturation(hybrid, 1.15)

    return hybrid


# ── Blend (Two Images) ───────────────────────────────────

def style_blend(img1, img2):
    """Blend two images with a smooth diagonal gradient mask,
    then apply light Kuwahara for painterly cohesion."""

    # Resize both to the same dimensions (use larger of the two)
    h = max(img1.shape[0], img2.shape[0])
    w = max(img1.shape[1], img2.shape[1])
    img1 = cv2.resize(img1, (w, h), interpolation=cv2.INTER_LANCZOS4)
    img2 = cv2.resize(img2, (w, h), interpolation=cv2.INTER_LANCZOS4)

    # Create smooth diagonal gradient mask
    ys, xs = np.mgrid[0:h, 0:w]
    mask = ((xs / w) * 0.6 + (ys / h) * 0.4).astype(np.float32)
    # Smooth the transition
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=min(w, h) * 0.15)
    # Normalize to 0-1
    mask = (mask - mask.min()) / (mask.max() - mask.min())
    mask3 = np.stack([mask] * 3, axis=-1)

    # Blend
    blended = (img1.astype(np.float32) * (1.0 - mask3) +
               img2.astype(np.float32) * mask3)
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    # Light Kuwahara for painterly cohesion at the seam
    lab = cv2.cvtColor(blended, cv2.COLOR_BGR2Lab)
    l_channel = cv2.split(lab)[0]
    blended = kuwahara(blended, method='gaussian', radius=3, sigma=1.2,
                       image_2d=l_channel)

    # Light bilateral to smooth the merge
    blended = cv2.bilateralFilter(blended, d=9, sigmaColor=50, sigmaSpace=50)

    # Saturation boost
    blended = boost_saturation(blended, 1.15)

    return blended


# ── Main ─────────────────────────────────────────────────

STYLES = {
    'oil': style_oil,
    'icm': style_icm,
    'hybrid': style_hybrid,
}


def main():
    # Two-image blend: painterly.py <input1> <input2> <output> blend
    if len(sys.argv) == 5 and sys.argv[4] == 'blend':
        input1, input2, output_path = sys.argv[1], sys.argv[2], sys.argv[3]
        img1 = cv2.imread(input1)
        img2 = cv2.imread(input2)
        if img1 is None:
            print(f"Failed to read image: {input1}", file=sys.stderr)
            sys.exit(1)
        if img2 is None:
            print(f"Failed to read image: {input2}", file=sys.stderr)
            sys.exit(1)
        result = style_blend(img1, img2)
        cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, 92])
        print(f"Saved blend to {output_path}")
        return

    # Single-image filter: painterly.py <input> <output> <style>
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <input> <output> <style>", file=sys.stderr)
        print(f"       {sys.argv[0]} <input1> <input2> <output> blend", file=sys.stderr)
        sys.exit(1)

    input_path, output_path, style = sys.argv[1], sys.argv[2], sys.argv[3]

    if style not in STYLES:
        print(f"Unknown style '{style}'. Choose from: {', '.join(STYLES)}", file=sys.stderr)
        sys.exit(1)

    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to read image: {input_path}", file=sys.stderr)
        sys.exit(1)

    result = STYLES[style](img)
    cv2.imwrite(output_path, result, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"Saved {style} filter to {output_path}")


if __name__ == '__main__':
    main()
