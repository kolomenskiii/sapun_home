import Foundation
import AVFoundation
import AppKit

// macOS: swift -module-cache-path /tmp/sapun-swift-cache scripts/extract-frames.swift [video] [output]
let input = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "kling_20261002_Image_to_Video_Transform__4429_0.mp4"
let output = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "assets/frames"
let asset = AVURLAsset(url: URL(fileURLWithPath: input))
let duration = CMTimeGetSeconds(asset.duration)
guard duration.isFinite && duration > 0 else { fatalError("Cannot read video") }
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 1600, height: 1600)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
try FileManager.default.createDirectory(atPath: output, withIntermediateDirectories: true)
let count = Int(ceil(duration * 24))
for index in 0..<count {
    let time = CMTime(seconds: Double(index) / 24, preferredTimescale: 600)
    let frame = try generator.copyCGImage(at: time, actualTime: nil)
    let bitmap = NSBitmapImageRep(cgImage: frame)
    let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.79])!
    try data.write(to: URL(fileURLWithPath: "\(output)/\(String(format: "%04d", index)).jpg"))
    if index % 24 == 0 { print("Frame \(index)/\(count), \(frame.width) × \(frame.height)") }
}
let manifest: [String: Any] = ["count": count, "fps": 24, "duration": duration]
let json = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
try json.write(to: URL(fileURLWithPath: "\(output)/manifest.json"))
print("Extracted \(count) frames")
