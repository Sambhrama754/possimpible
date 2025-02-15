import {FD_STDIN, FD_STDOUT} from "../../../public/api";
import {Status} from "../../../public/status";

let syscall = self.proc.sys;
setTimeout(async () => {
    let fd = await self.proc.sys.open(self.proc.argv[1], 0);
    let char = await self.proc.sys.read(fd, -1);
    self.proc.sys.write(FD_STDOUT, char.replaceAll("\n", "\n\r"));
    await self.proc.sys.die(Status.OK)
}, 0)

