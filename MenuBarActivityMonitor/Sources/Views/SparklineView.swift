import SwiftUI

public struct SparklineView: View {
    public let data: [Double]
    public let lineColor: Color
    public let maxValue: Double

    public init(data: [Double], lineColor: Color = .blue, maxValue: Double = 100.0) {
        self.data = data
        self.lineColor = lineColor
        self.maxValue = maxValue
    }

    public var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height

            if data.count >= 2 {
                let stepX = width / CGFloat(max(1, data.count - 1))

                // Line Path
                Path { path in
                    for (index, value) in data.enumerated() {
                        let norm = max(0.0, min(1.0, value / maxValue))
                        let x = CGFloat(index) * stepX
                        let y = height - (CGFloat(norm) * height)

                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(lineColor, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))

                // Gradient Fill Path
                Path { path in
                    for (index, value) in data.enumerated() {
                        let norm = max(0.0, min(1.0, value / maxValue))
                        let x = CGFloat(index) * stepX
                        let y = height - (CGFloat(norm) * height)

                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: height))
                            path.addLine(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                    path.addLine(to: CGPoint(x: width, y: height))
                    path.closeSubpath()
                }
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [lineColor.opacity(0.25), lineColor.opacity(0.02)]),
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            } else {
                // Empty placeholder
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.secondary.opacity(0.1))
            }
        }
    }
}
