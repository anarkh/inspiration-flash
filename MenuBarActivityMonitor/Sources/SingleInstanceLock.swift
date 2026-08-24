import Darwin
import Foundation

enum SingleInstanceLockError: LocalizedError {
    case alreadyRunning
    case openFailed(path: String, code: Int32)

    var errorDescription: String? {
        switch self {
        case .alreadyRunning:
            return "another instance is already running"
        case let .openFailed(path, code):
            return "unable to open \(path): \(posixErrorDescription(code))"
        }
    }

    private func posixErrorDescription(_ code: Int32) -> String {
        String(cString: strerror(code))
    }
}

final class SingleInstanceLock {
    private let fileDescriptor: Int32

    private init(fileDescriptor: Int32) {
        self.fileDescriptor = fileDescriptor
    }

    static func acquire(
        at requestedLockURL: URL? = nil
    ) throws -> SingleInstanceLock {
        let lockURL: URL
        if let requestedLockURL {
            lockURL = requestedLockURL
        } else {
            let applicationSupportURL = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let lockDirectoryURL = applicationSupportURL
                .appendingPathComponent("MenuBarActivityMonitor", isDirectory: true)
            try FileManager.default.createDirectory(
                at: lockDirectoryURL,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            lockURL = lockDirectoryURL
                .appendingPathComponent("instance.lock", isDirectory: false)
        }

        let lockPath = lockURL.path

        // O_EXLOCK acquires the kernel lock atomically; O_NONBLOCK makes a held lock fail immediately.
        let descriptor = Darwin.open(
            lockPath,
            O_CREAT | O_RDWR | O_CLOEXEC | O_EXLOCK | O_NONBLOCK | O_NOFOLLOW,
            mode_t(S_IRUSR | S_IWUSR)
        )
        guard descriptor >= 0 else {
            let errorCode = errno
            if errorCode == EWOULDBLOCK || errorCode == EAGAIN {
                throw SingleInstanceLockError.alreadyRunning
            }
            throw SingleInstanceLockError.openFailed(path: lockPath, code: errorCode)
        }

        return SingleInstanceLock(fileDescriptor: descriptor)
    }

    deinit {
        // Closing releases the lock. Keep the file so a new inode cannot bypass a current lock owner.
        Darwin.close(fileDescriptor)
    }
}
