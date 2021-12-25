import {IKernelModule} from "../../sys/modules";
import {Kernel} from "../../kernel";
import {ContainerStatus, IContainer, IContainerOperations} from "../orchestrator";
import {v4 as UUID} from 'uuid';
// @ts-ignore
import workerImage from '&/worker.img';
import {IProcMessage, IProcStart, MessageType} from "../../../shared/proc";

interface WorkerBucket{
    id: UUID,
    worker: Worker,
    container?: IContainer,
    resolve: (container: IContainer | PromiseLike<IContainer>) => void;
    handler?: (message: IProcMessage, container: IContainer) => void;
}
const workers = new Map<string, WorkerBucket>();

function init(kernel: Kernel){
    kernel.orchestrators.registerOrchestrator({
        name: "lorch",
        getcontainer: () => new Promise<IContainer>(resolve => {
            const id = UUID();
            const wrk = new Worker(workerImage, {
                name: "" + id
            });
            const buck = {
                id: id,
                worker: wrk,
                resolve,
            }
            workers.set(id, buck)
            wrk.addEventListener("message", ev => handleMessage(ev, buck));
        })
    })
}

const containerOperations: IContainerOperations = {
    run:(container, code, listener) =>{
        const buck = workers.get(container.id)!;
        buck.handler = listener;
        const msg: IProcStart = {
            id: "",
            code: code,
            type: MessageType.START,
        }
        container.status = ContainerStatus.RUNNING;
        buck.worker.postMessage(msg)
    },
    kill: container => {
        const buck = workers.get(container.id)!;
        buck.worker.terminate();
        workers.delete(buck.id);
        container.status = ContainerStatus.STOPPED;
    },
    send:(container, message) => {
        const buck = workers.get(container.id)!;
        buck.worker.postMessage(message);
    }
}


function handleMessage(message: MessageEvent<IProcMessage>, bucket: WorkerBucket){
    if(message.data.type == MessageType.READY){
        bucket.container = {
            id: bucket.id,
            status: ContainerStatus.WAITING,
            operations: containerOperations
        };
        bucket.resolve(bucket.container)
    }else{
        if (bucket.handler) {
            bucket.handler(message.data, bucket.container!);
        }
    }
}

function cleanup(){

}

const m: IKernelModule = {
    name: "lorch",
    init: init,
    cleanup: cleanup
}

export default m;
