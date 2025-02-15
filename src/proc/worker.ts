import {
    IProcChCwd,
    IProcClose,
    IProcDie, IProcError,
    IProcExec,
    IProcExecRes,
    IProcGetCwd,
    IProcGetCwdRes,
    IProcGetDEnts,
    IProcGetDEntsRes,
    IProcMessage,
    IProcMkdir,
    IProcMount,
    IProcOpen,
    IProcOpenRes,
    IProcRead,
    IProcReadRes,
    IProcRmdir,
    IProcStart,
    IProcUnmount,
    IProcWrite,
    IProcWriteRes,
    MessageID,
    MessageType,
} from "../shared/proc";
import {FileDescriptor, IDirectoryEntry, ISystemCalls, OpenOptions} from "../public/api";
import {PError, Status} from "../public/status";

export class Process{
    private router = new Map<MessageID, (message: IProcMessage) => void>();
    public argv?: string[]
    public sys : ISystemCalls = {
        read: this.sys_read.bind(this),
        write: this.sys_write.bind(this),
        open: this.sys_open.bind(this),
        getcwd: this.sys_getcwd.bind(this),
        getdents: this.sys_getdents.bind(this),
        close: this.sys_close.bind(this),
        exec: this.sys_exec.bind(this),
        chcwd: this.sys_chcwd.bind(this),
        die: this.sys_die.bind(this),
        mount: this.sys_mount.bind(this),
        unmount: this.sys_unmount.bind(this),
        mkdir: this.sys_mkdir.bind(this),
        rmdir: this.sys_rmdir.bind(this),
    }

    private uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    constructor() {
        self.addEventListener("message", ev => this.handleMessage(ev));
        self.postMessage({type: MessageType.READY, id:this.uuidv4()})
    }

    private handleMessage(handle: MessageEvent<IProcMessage>){
        let message = handle.data;
        if (message.type >= MessageType.READ_RES){
            if(this.router.has(message.id)){
                this.router.get(message.id)!.call(null, message);
                this.router.delete(message.id);
            }
        }else if(message.type == MessageType.START){
            let startMsg = message as IProcStart;
            this.argv = startMsg.argv;
            for (const dep of startMsg.dyna) {
                (self as any)[dep.name] = null;
                eval(dep.code);
            }
            eval(startMsg.code);
        }
    }

    private call(message: IProcMessage){
        self.postMessage(message);
    }

    private callWithPromise(message: IProcMessage) : Promise<IProcMessage>{
        return new Promise<IProcMessage>((resolve, reject) => {
            this.router.set(message.id, response => {
                this.router.delete(message.id);
                if (response.type != MessageType.ERROR){
                    resolve(response);
                }else{
                    let res = response as IProcError
                    reject(new PError(res.code))
                }
            });
            self.postMessage(message);
        })
    }

    private async sys_read(fd: FileDescriptor, count: number) : Promise<string>{
        const param: IProcRead = {
            type: MessageType.READ,
            id: this.uuidv4(),
            fd: fd,
            count: count
        };
        const res = await this.callWithPromise(param) as IProcReadRes;

        return res.buf;
    }

    private async sys_write(fd: FileDescriptor, buf: string) {
        const param: IProcWrite = {
            type: MessageType.WRITE,
            id: this.uuidv4(),
            buf: buf,
            fd: fd,
        }

        const res = await this.callWithPromise(param) as IProcWriteRes;
    }

    private async sys_open(path: string, flags: OpenOptions): Promise<FileDescriptor>{
        const param: IProcOpen = {
            type: MessageType.OPEN,
            id: this.uuidv4(),
            path: path,
            flags: flags
        };
        const res = await this.callWithPromise(param) as IProcOpenRes;

        return res.fd;
    }

    private sys_close(fd: FileDescriptor){
        const param: IProcClose = {
            type: MessageType.CLOSE,
            id: this.uuidv4(),
            fd: fd
        };

        this.call(param);
    }

    private async sys_getdents(fd: FileDescriptor, count: number) : Promise<IDirectoryEntry[]>{
        const param: IProcGetDEnts = {
            type: MessageType.GETDENTS,
            id: this.uuidv4(),
            fd,
            count,
        };
        const res = await this.callWithPromise(param) as IProcGetDEntsRes;

        return res.dirents;
    }

    private async sys_getcwd() : Promise<string>{
        const param: IProcGetCwd = {
            type: MessageType.GETCWD,
            id: this.uuidv4()
        };
        const res = await this.callWithPromise(param) as IProcGetCwdRes;

        return res.cwd;
    }

    private async sys_exec(path: string, argv:string[]) : Promise<number>{
        const param: IProcExec = {
            type: MessageType.EXEC,
            id: this.uuidv4(),
            path: path,
            argv: argv
        };
        const res = await this.callWithPromise(param) as IProcExecRes;

        return res.pid;
    }

    private async sys_chcwd(path: string){
        const param: IProcChCwd = {
            type: MessageType.CHCWD,
            id: this.uuidv4(),
            path: path
        };
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }

    private async sys_die(number: Status){
        const param: IProcDie = {
            type: MessageType.DIE,
            id: this.uuidv4(),
            status: number
        };

        // wait to block
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }

    private async sys_mount(fstype: string, device: string, options: string, mountpoint: string){
        const param: IProcMount = {
            device: device, fstype: fstype, options: options,
            type: MessageType.MOUNT,
            id: this.uuidv4(),
            mountpoint: mountpoint
        };

        // wait to block
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }

    private async sys_unmount(path:string){
        const param: IProcUnmount = {
            type: MessageType.UNMOUNT,
            id: this.uuidv4(),
            path: path,
        };

        // wait to block
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }

    private async sys_mkdir(path:string){
        const param: IProcMkdir = {
            type: MessageType.MKDIR,
            id: this.uuidv4(),
            path: path,
        };

        // wait to block
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }

    private async sys_rmdir(path:string){
        const param: IProcRmdir = {
            type: MessageType.RMDIR,
            id: this.uuidv4(),
            path: path,
        };

        // wait to block
        const res = await this.callWithPromise(param) as IProcExecRes;
        return
    }
}
