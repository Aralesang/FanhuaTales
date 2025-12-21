import * as ex from 'excalibur';
import { PlayerControlComponent } from '../components/player-control-component';
import { ActorState, StateMachineComponent } from '../components/state-machine-component';
import { DirectionComponent } from '../components/direction-component';

export class PlayerControlSystem extends ex.System {
    //定义这个系统感兴趣的组件
    public systemType = ex.SystemType.Update;
    public query: ex.Query<
        typeof ex.TransformComponent |
        typeof PlayerControlComponent |
        typeof StateMachineComponent |
        typeof DirectionComponent
    >;

    private _horizontalKeys: ex.Keys[] = [];
    private _verticalKeys: ex.Keys[] = [];

    constructor(world: ex.World, private engine: ex.Engine) {
        super();
        this.query = world.query([
            ex.TransformComponent,
            PlayerControlComponent,
            StateMachineComponent,
            DirectionComponent
        ]);

        // 监听按键按下，维护按键栈，确保最后按下的按键优先级最高
        this.engine.input.keyboard.on('press', (evt) => {
            const key = evt.key;
            if (key === ex.Keys.Left || key === ex.Keys.Right) {
                // 如果已经在栈中，先移除，再添加到末尾（表示最新）
                this._horizontalKeys = this._horizontalKeys.filter(k => k !== key);
                this._horizontalKeys.push(key);
            }
            if (key === ex.Keys.Up || key === ex.Keys.Down) {
                this._verticalKeys = this._verticalKeys.filter(k => k !== key);
                this._verticalKeys.push(key);
            }
        });

        // 监听按键释放，从栈中移除
        this.engine.input.keyboard.on('release', (evt) => {
            const key = evt.key;
            if (key === ex.Keys.Left || key === ex.Keys.Right) {
                this._horizontalKeys = this._horizontalKeys.filter(k => k !== key);
            }
            if (key === ex.Keys.Up || key === ex.Keys.Down) {
                this._verticalKeys = this._verticalKeys.filter(k => k !== key);
            }
        });
    }

    update(delta: number): void {
        const kb = this.engine.input.keyboard;

        // 获取当前有效的按键（栈顶是最后按下的）
        // 增加一个额外的检查: kb.isHeld(key) 确保按键确实是按下的（防止状态不同步）
        const horizontalKey = this._horizontalKeys.slice().reverse().find(k => kb.isHeld(k));
        const verticalKey = this._verticalKeys.slice().reverse().find(k => kb.isHeld(k));

        for (let entity of this.query.entities) {
            const transform = entity.get(ex.TransformComponent);
            const control = entity.get(PlayerControlComponent);
            const stateMachine = entity.get(StateMachineComponent);
            const direction = entity.get(DirectionComponent);
            let velX = 0;
            let velY = 0;

            if (verticalKey === ex.Keys.Up) {
                velY = -control.speed;
                direction.direction = ex.Vector.Up;
            } else if (verticalKey === ex.Keys.Down) {
                velY = control.speed;
                direction.direction = ex.Vector.Down;
            }

            if (horizontalKey === ex.Keys.Left) {
                velX = -control.speed;
                direction.direction = ex.Vector.Left;
            } else if (horizontalKey === ex.Keys.Right) {
                velX = control.speed;
                direction.direction = ex.Vector.Right;
            }

            if (velX != 0 || velY != 0) {
                stateMachine.changeState(ActorState.Run, entity);
            } else {
                stateMachine.changeState(ActorState.Idle, entity);
            }
            if (kb.isHeld(ex.Keys.Q)) {
                //场景切换
                this.engine.goToScene('TestMpa');
            }
            // 计算每一帧的位移 (速度 * 时间)
            // 注意：如果你用了 Actor，也可以直接修改 entity.vel，
            // 但为了演示纯粹的 ECS，我们直接修改坐标
            const deltaSeconds = delta / 1000;
            transform.pos.x += velX * deltaSeconds;
            transform.pos.y += velY * deltaSeconds;

        }
    }
}