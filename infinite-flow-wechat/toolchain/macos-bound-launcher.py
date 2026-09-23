"""macOS Cocos Creator launch boundary.

The attested bytes of this file are supplied to a root-owned, isolated Python
interpreter with ``-c``.  The repository pathname is never imported or opened
by that interpreter.
"""

import ctypes
import fcntl
import hashlib
import json
import os
import struct
import sys


EXECUTABLE_FD = 3
CONFIG_FD = 4
STATUS_FD = 5
CHILD_CONFIG_FD = 198

F_GETFL = 3
F_ADDFILESIGS_INFO = 103
POSIX_SPAWN_START_SUSPENDED = 0x0080
CS_OPS_STATUS = 0
CS_OPS_CDHASH = 5
CS_VALID = 0x00000001
CS_KILL = 0x00000200
LC_CODE_SIGNATURE = 0x1D
CPU_TYPE_ARM64 = 0x0100000C
CPU_TYPE_X86_64 = 0x01000007
MAX_STRING_BYTES = 64 * 1024
MAX_LOAD_COMMAND_BYTES = 64 * 1024 * 1024
MAX_INTERPOSITION_OPERATIONS = 16
SIGKILL = 9
SIGCONT = 19


class Boundary(Exception):
    pass


LIBC = ctypes.CDLL(None, use_errno=True)
LIBC.posix_spawn_file_actions_init.argtypes = [ctypes.POINTER(ctypes.c_void_p)]
LIBC.posix_spawn_file_actions_init.restype = ctypes.c_int
LIBC.posix_spawn_file_actions_destroy.argtypes = [ctypes.POINTER(ctypes.c_void_p)]
LIBC.posix_spawn_file_actions_destroy.restype = ctypes.c_int
LIBC.posix_spawn_file_actions_adddup2.argtypes = [
    ctypes.POINTER(ctypes.c_void_p), ctypes.c_int, ctypes.c_int
]
LIBC.posix_spawn_file_actions_adddup2.restype = ctypes.c_int
LIBC.posix_spawn_file_actions_addclose.argtypes = [
    ctypes.POINTER(ctypes.c_void_p), ctypes.c_int
]
LIBC.posix_spawn_file_actions_addclose.restype = ctypes.c_int
LIBC.posix_spawnattr_init.argtypes = [ctypes.POINTER(ctypes.c_void_p)]
LIBC.posix_spawnattr_init.restype = ctypes.c_int
LIBC.posix_spawnattr_destroy.argtypes = [ctypes.POINTER(ctypes.c_void_p)]
LIBC.posix_spawnattr_destroy.restype = ctypes.c_int
LIBC.posix_spawnattr_setflags.argtypes = [
    ctypes.POINTER(ctypes.c_void_p), ctypes.c_short
]
LIBC.posix_spawnattr_setflags.restype = ctypes.c_int
LIBC.posix_spawn.argtypes = [
    ctypes.POINTER(ctypes.c_int),
    ctypes.c_char_p,
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.POINTER(ctypes.c_char_p),
    ctypes.POINTER(ctypes.c_char_p),
]
LIBC.posix_spawn.restype = ctypes.c_int
LIBC.csops.argtypes = [
    ctypes.c_int, ctypes.c_uint, ctypes.c_void_p, ctypes.c_size_t
]
LIBC.csops.restype = ctypes.c_int


def boundary(condition, code):
    if not condition:
        raise Boundary(code)


def text(value, *, allow_empty=False):
    boundary(type(value) is str, "bound-launch-arguments-invalid")
    encoded = os.fsencode(value)
    boundary(
        (allow_empty or len(encoded) > 0)
        and len(encoded) <= MAX_STRING_BYTES
        and b"\0" not in encoded,
        "bound-launch-arguments-invalid",
    )
    return value


def absolute_path(value):
    value = text(value)
    boundary(os.path.isabs(value), "bound-launch-arguments-invalid")
    return value


def parse_sha256(value):
    boundary(
        type(value) is str
        and len(value) == 64
        and all(character in "0123456789abcdef" for character in value),
        "bound-launch-arguments-invalid",
    )
    return bytes.fromhex(value)


def stable_identity(stat_result):
    return (
        stat_result.st_dev,
        stat_result.st_ino,
        stat_result.st_mode,
        stat_result.st_uid,
        stat_result.st_gid,
        stat_result.st_size,
        stat_result.st_mtime_ns,
        stat_result.st_ctime_ns,
        stat_result.st_nlink,
    )


def hash_descriptor(fd):
    before = os.fstat(fd)
    boundary(
        before.st_mode & 0o170000 == 0o100000,
        "bound-launch-object-invalid",
    )
    boundary(before.st_size >= 0, "bound-launch-object-invalid")
    digest = hashlib.sha256()
    offset = 0
    while offset < before.st_size:
        chunk = os.pread(fd, min(64 * 1024, before.st_size - offset), offset)
        boundary(len(chunk) > 0, "bound-launch-object-invalid")
        digest.update(chunk)
        offset += len(chunk)
    after = os.fstat(fd)
    boundary(
        stable_identity(before) == stable_identity(after),
        "bound-launch-object-drift",
    )
    return digest.digest(), after


def read_exact(fd, length, offset):
    boundary(length >= 0 and offset >= 0, "bound-launch-executable-signature-unavailable")
    result = bytearray()
    while len(result) < length:
        chunk = os.pread(fd, length - len(result), offset + len(result))
        boundary(len(chunk) > 0, "bound-launch-executable-signature-unavailable")
        result.extend(chunk)
    return bytes(result)


def host_cpu_type():
    machine = os.uname().machine
    if machine in ("arm64", "arm64e"):
        return CPU_TYPE_ARM64
    if machine == "x86_64":
        return CPU_TYPE_X86_64
    raise Boundary("bound-launch-host-architecture-unsupported")


def select_macho_slice(fd, file_size):
    magic = read_exact(fd, 4, 0)
    if magic == b"\xcf\xfa\xed\xfe":
        return 0, file_size
    boundary(
        magic in (b"\xca\xfe\xba\xbe", b"\xca\xfe\xba\xbf"),
        "bound-launch-executable-signature-unavailable",
    )
    fat64 = magic == b"\xca\xfe\xba\xbf"
    count = struct.unpack(">I", read_exact(fd, 4, 4))[0]
    boundary(0 < count <= 128, "bound-launch-executable-signature-unavailable")
    record_size = 32 if fat64 else 20
    wanted = host_cpu_type()
    for index in range(count):
        record = read_exact(fd, record_size, 8 + index * record_size)
        if fat64:
            cpu_type, _subtype, offset, size, _align, _reserved = struct.unpack(
                ">iiQQII", record
            )
        else:
            cpu_type, _subtype, offset, size, _align = struct.unpack(">iiIII", record)
        if cpu_type != wanted:
            continue
        boundary(
            size > 0 and offset <= file_size and size <= file_size - offset,
            "bound-launch-executable-signature-unavailable",
        )
        return offset, size
    raise Boundary("bound-launch-executable-signature-unavailable")


def descriptor_cdhash(fd, file_size):
    slice_offset, slice_size = select_macho_slice(fd, file_size)
    boundary(slice_size >= 32, "bound-launch-executable-signature-unavailable")
    header = read_exact(fd, 32, slice_offset)
    magic, cpu_type, _subtype, _filetype, ncmds, command_bytes, _flags, _reserved = (
        struct.unpack("<IiiIIIII", header)
    )
    boundary(
        magic == 0xFEEDFACF
        and cpu_type == host_cpu_type()
        and 0 < command_bytes <= MAX_LOAD_COMMAND_BYTES
        and command_bytes <= slice_size - 32,
        "bound-launch-executable-signature-unavailable",
    )
    commands = read_exact(fd, command_bytes, slice_offset + 32)
    cursor = 0
    signature_offset = None
    signature_size = None
    for _index in range(ncmds):
        boundary(
            cursor <= len(commands) - 8,
            "bound-launch-executable-signature-unavailable",
        )
        command, command_size = struct.unpack_from("<II", commands, cursor)
        boundary(
            command_size >= 8 and command_size <= len(commands) - cursor,
            "bound-launch-executable-signature-unavailable",
        )
        if command == LC_CODE_SIGNATURE:
            boundary(command_size >= 16, "bound-launch-executable-signature-unavailable")
            _command, _size, signature_offset, signature_size = struct.unpack_from(
                "<IIII", commands, cursor
            )
            break
        cursor += command_size
    boundary(
        signature_offset is not None
        and signature_size is not None
        and signature_size > 0
        and signature_offset <= slice_size
        and signature_size <= slice_size - signature_offset,
        "bound-launch-executable-signature-unavailable",
    )

    signatures_format = "@qPnn20si"
    signatures_size = struct.calcsize(signatures_format)
    signatures = struct.pack(
        signatures_format,
        slice_offset,
        signature_offset,
        signature_size,
        signatures_size,
        b"\0" * 20,
        0,
    )
    try:
        signatures = fcntl.fcntl(fd, F_ADDFILESIGS_INFO, signatures)
    except OSError:
        raise Boundary("bound-launch-executable-signature-unavailable")
    cdhash = struct.unpack(signatures_format, signatures)[4]
    boundary(any(cdhash), "bound-launch-executable-signature-unavailable")
    return cdhash


def validate_interposition(value):
    if value is None:
        return None
    boundary(type(value) is dict, "bound-launch-test-hook-invalid")
    boundary(
        set(value) <= {"renames", "writeFiles", "probeConfigWrite"},
        "bound-launch-test-hook-invalid",
    )
    renames = value.get("renames", [])
    write_files = value.get("writeFiles", [])
    probe = value.get("probeConfigWrite", False)
    boundary(
        type(renames) is list
        and type(write_files) is list
        and type(probe) is bool
        and len(renames) <= MAX_INTERPOSITION_OPERATIONS
        and len(write_files) <= MAX_INTERPOSITION_OPERATIONS,
        "bound-launch-test-hook-invalid",
    )
    normalized_renames = []
    for operation in renames:
        boundary(
            type(operation) is list and len(operation) == 2,
            "bound-launch-test-hook-invalid",
        )
        normalized_renames.append(
            (absolute_path(operation[0]), absolute_path(operation[1]))
        )
    normalized_writes = []
    for operation in write_files:
        boundary(
            type(operation) is dict and set(operation) == {"path", "contentHex"},
            "bound-launch-test-hook-invalid",
        )
        content_hex = operation["contentHex"]
        boundary(
            type(content_hex) is str
            and len(content_hex) <= MAX_STRING_BYTES * 2
            and len(content_hex) % 2 == 0
            and all(character in "0123456789abcdef" for character in content_hex),
            "bound-launch-test-hook-invalid",
        )
        normalized_writes.append(
            (absolute_path(operation["path"]), bytes.fromhex(content_hex))
        )
    return normalized_renames, normalized_writes, probe


def write_all(fd, content):
    offset = 0
    while offset < len(content):
        count = os.write(fd, content[offset:])
        boundary(count > 0, "bound-launch-test-hook-failed")
        offset += count


def perform_interposition(interposition):
    if interposition is None:
        return
    renames, write_files, probe = interposition
    for source, destination in renames:
        os.rename(source, destination)
    for path, content in write_files:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            write_all(fd, content)
            os.fsync(fd)
        finally:
            os.close(fd)
    if probe:
        duplicate = None
        try:
            duplicate = os.open("/dev/fd/4", os.O_WRONLY)
            try:
                os.pwrite(duplicate, b"X", 0)
            except OSError:
                pass
            else:
                raise Boundary("bound-launch-config-write-probe-succeeded")
        except OSError:
            pass
        finally:
            if duplicate is not None:
                os.close(duplicate)


def c_array(values):
    encoded = [os.fsencode(value) for value in values]
    array = (ctypes.c_char_p * (len(encoded) + 1))()
    for index, value in enumerate(encoded):
        array[index] = value
    array[len(encoded)] = None
    return array


def terminate_child(pid):
    try:
        os.kill(pid, SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.kill(pid, SIGCONT)
    except ProcessLookupError:
        pass
    while True:
        try:
            os.waitpid(pid, 0)
            return
        except InterruptedError:
            continue
        except ChildProcessError:
            return


def spawn_suspended(executable_path, arguments, working_directory):
    actions = ctypes.c_void_p()
    attributes = ctypes.c_void_p()
    actions_initialized = False
    attributes_initialized = False
    child = ctypes.c_int(-1)
    try:
        boundary(
            LIBC.posix_spawn_file_actions_init(ctypes.byref(actions)) == 0,
            "bound-launch-file-actions-failed",
        )
        actions_initialized = True
        add_chdir = getattr(
            LIBC,
            "posix_spawn_file_actions_addchdir",
            getattr(LIBC, "posix_spawn_file_actions_addchdir_np", None),
        )
        boundary(add_chdir is not None, "bound-launch-file-actions-failed")
        add_chdir.argtypes = [ctypes.POINTER(ctypes.c_void_p), ctypes.c_char_p]
        add_chdir.restype = ctypes.c_int
        boundary(
            LIBC.posix_spawn_file_actions_adddup2(
                ctypes.byref(actions), CONFIG_FD, CHILD_CONFIG_FD
            ) == 0
            and add_chdir(ctypes.byref(actions), os.fsencode(working_directory)) == 0
            and LIBC.posix_spawn_file_actions_addclose(
                ctypes.byref(actions), EXECUTABLE_FD
            ) == 0
            and LIBC.posix_spawn_file_actions_addclose(
                ctypes.byref(actions), CONFIG_FD
            ) == 0
            and LIBC.posix_spawn_file_actions_addclose(
                ctypes.byref(actions), STATUS_FD
            ) == 0,
            "bound-launch-file-actions-failed",
        )
        boundary(
            LIBC.posix_spawnattr_init(ctypes.byref(attributes)) == 0,
            "bound-launch-attributes-failed",
        )
        attributes_initialized = True
        boundary(
            LIBC.posix_spawnattr_setflags(
                ctypes.byref(attributes), POSIX_SPAWN_START_SUSPENDED
            ) == 0,
            "bound-launch-attributes-failed",
        )
        environment = c_array(
            ["{}={}".format(key, value) for key, value in os.environ.items()]
        )
        child_arguments = c_array(arguments)
        result = LIBC.posix_spawn(
            ctypes.byref(child),
            os.fsencode(executable_path),
            ctypes.byref(actions),
            ctypes.byref(attributes),
            child_arguments,
            environment,
        )
        boundary(result == 0 and child.value > 0, "bound-launch-posix-spawn-failed")
        return child.value
    finally:
        if attributes_initialized:
            LIBC.posix_spawnattr_destroy(ctypes.byref(attributes))
        if actions_initialized:
            LIBC.posix_spawn_file_actions_destroy(ctypes.byref(actions))


def child_identity(pid):
    cdhash = (ctypes.c_ubyte * 20)()
    status = ctypes.c_uint(0)
    boundary(
        LIBC.csops(pid, CS_OPS_CDHASH, ctypes.byref(cdhash), ctypes.sizeof(cdhash)) == 0
        and LIBC.csops(pid, CS_OPS_STATUS, ctypes.byref(status), ctypes.sizeof(status)) == 0,
        "bound-launch-child-image-mismatch",
    )
    return bytes(cdhash), status.value


def parse_payload():
    boundary(len(sys.argv) == 2, "bound-launch-arguments-invalid")
    payload = json.loads(sys.argv[1])
    boundary(
        type(payload) is dict
        and set(payload)
        == {
            "executablePath",
            "executableSha256",
            "configSha256",
            "cocosProject",
            "platform",
            "cwd",
            "testInterposition",
        },
        "bound-launch-arguments-invalid",
    )
    executable_path = absolute_path(payload["executablePath"])
    cocos_project = absolute_path(payload["cocosProject"])
    working_directory = absolute_path(payload["cwd"])
    platform = text(payload["platform"])
    boundary(
        all(character in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in platform),
        "bound-launch-arguments-invalid",
    )
    return (
        executable_path,
        parse_sha256(payload["executableSha256"]),
        parse_sha256(payload["configSha256"]),
        cocos_project,
        platform,
        working_directory,
        validate_interposition(payload["testInterposition"]),
    )


def main():
    (
        executable_path,
        expected_executable_sha,
        expected_config_sha,
        cocos_project,
        platform,
        working_directory,
        interposition,
    ) = parse_payload()

    executable_flags = fcntl.fcntl(EXECUTABLE_FD, F_GETFL)
    boundary(
        executable_flags >= 0 and executable_flags & os.O_ACCMODE == os.O_RDONLY,
        "bound-launch-executable-object-invalid",
    )
    executable_sha, executable_stat = hash_descriptor(EXECUTABLE_FD)
    boundary(
        executable_sha == expected_executable_sha
        and executable_stat.st_mode & 0o111 != 0,
        "bound-launch-executable-object-invalid",
    )
    expected_cdhash = descriptor_cdhash(EXECUTABLE_FD, executable_stat.st_size)

    config_flags = fcntl.fcntl(CONFIG_FD, F_GETFL)
    boundary(
        config_flags >= 0 and config_flags & os.O_ACCMODE == os.O_RDONLY,
        "bound-launch-config-object-invalid",
    )
    config_sha, config_stat = hash_descriptor(CONFIG_FD)
    boundary(
        config_sha == expected_config_sha
        and config_stat.st_nlink == 0
        and config_stat.st_mode & 0o222 == 0,
        "bound-launch-config-object-invalid",
    )

    # This is the deterministic test seam: both retained objects have passed
    # their final validation and no executable pathname has been resolved.
    perform_interposition(interposition)

    os.lseek(CONFIG_FD, 0, os.SEEK_SET)
    build_argument = "configPath=/dev/fd/{};platform={};".format(
        CHILD_CONFIG_FD, platform
    )
    arguments = [
        executable_path,
        "--project",
        cocos_project,
        "--build",
        build_argument,
    ]
    child = spawn_suspended(executable_path, arguments, working_directory)
    try:
        loaded_cdhash, signing_status = child_identity(child)
        if loaded_cdhash != expected_cdhash:
            raise Boundary("bound-launch-child-image-mismatch")
        if signing_status & (CS_VALID | CS_KILL) != (CS_VALID | CS_KILL):
            raise Boundary("bound-launch-child-signing-policy-mismatch")
        os.kill(child, SIGCONT)
        while True:
            try:
                _pid, wait_status = os.waitpid(child, 0)
                child = -1
                break
            except InterruptedError:
                continue
        if os.WIFEXITED(wait_status):
            return os.WEXITSTATUS(wait_status)
        if os.WIFSIGNALED(wait_status):
            return 128 + os.WTERMSIG(wait_status)
        raise Boundary("bound-launch-wait-failed")
    finally:
        if child > 0:
            terminate_child(child)


def report_boundary(code):
    message = ("BOUNDARY_ERROR:" + code + "\n").encode("ascii", "strict")
    offset = 0
    while offset < len(message):
        try:
            count = os.write(STATUS_FD, message[offset:])
        except OSError:
            break
        if count <= 0:
            break
        offset += count
    os._exit(125)


try:
    os._exit(main())
except Boundary as error:
    report_boundary(str(error))
except BaseException:
    report_boundary("bound-launch-helper-failed")
