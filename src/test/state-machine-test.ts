import { StateMachine, StateMachineDescription } from "excalibur";

interface LightContext {
    color: string;
}
export class StateMachinTest {
    static test() {
        const lightMachineDesc: StateMachineDescription<LightContext> = {
            start: "off",
            states: {
                off: {
                    transitions: ["on"],
                    onEnter: () => {
                        console.log("灯灭了");
                    }
                },
                on: {
                    transitions: ["off"],
                    onEnter: ({data, eventData}) => {
                        console.log("灯亮了", data);
                    }
                }
            }
        } as const;
        const lightMachine = StateMachine.create(lightMachineDesc, { color: "white" });

        lightMachine.go("on", {color: "red" });
    }
}