// Generates the iOS launch images in assets/splash/ (page background + app icon at 96pt,
// identical to #initial-splash in inject-meta.js). File name = CSS size @ pixel ratio.
// Run on macOS when the icon changes or a new iPhone size appears:
//   swift scripts/generateSplash.swift assets/icons/icon-512.png assets/splash
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let a = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil)!
let icon = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let devices: [(Int, Int, Int)] = [(320,568,2),(375,667,2),(414,736,3),(375,812,3),(414,896,2),(414,896,3),
  (390,844,3),(428,926,3),(393,852,3),(430,932,3),(402,874,3),(440,956,3),(420,912,3)]
for (w, h, r) in devices {
  let pw = w * r, ph = h * r
  let ctx = CGContext(data: nil, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.setFillColor(CGColor(srgbRed: 0xF8/255, green: 0xF8/255, blue: 0xF2/255, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: pw, height: ph))
  ctx.interpolationQuality = .high
  let s = 96 * r
  ctx.draw(icon, in: CGRect(x: (pw - s) / 2, y: (ph - s) / 2, width: s, height: s))
  let url = URL(fileURLWithPath: "\(a[2])/splash-\(w)x\(h)@\(r)x.png")
  let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
  CGImageDestinationFinalize(dest)
}
