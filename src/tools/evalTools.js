import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT_DIR = process.cwd();

const BrowserFS = {
    write: (filename, content) => {
        const resolvedPath = path.resolve(ROOT_DIR, filename);
        if (!resolvedPath.startsWith(ROOT_DIR)) {
            throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
        }
        fs.writeFileSync(resolvedPath, content, 'utf8');
        return { status: 'OK', file: filename };
    },
    read: (filename) => {
        const resolvedPath = path.resolve(ROOT_DIR, filename);
        if (!resolvedPath.startsWith(ROOT_DIR)) {
            throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
        }
        return fs.readFileSync(resolvedPath, 'utf8');
    },
    list: () => {
        return fs.readdirSync(ROOT_DIR);
    },
    delete: (filename) => {
        const resolvedPath = path.resolve(ROOT_DIR, filename);
        if (!resolvedPath.startsWith(ROOT_DIR)) {
            throw new Error(`SECURITY_ERR: Access denied to ${filename}`);
        }
        fs.unlinkSync(resolvedPath);
        return { status: 'OK', deleted: filename };
    }
};

class EvalCore {
    constructor() {
        this.trace = [];
        this.context = this._createContext();
    }

    _createContext() {
        const sandbox = {
            BrowserFS,
            console: {
                log: (...args) => this._log('AI_LOG', args),
                error: (...args) => this._log('AI_ERR', args),
                warn: (...args) => this._log('AI_WARN', args),
            },
            window: {},
            navigator: { userAgent: 'eval()-V8-Surgical-Sandbox/1.0' },
        };
        return vm.createContext(sandbox);
    }

    _log(type, args) {
        const argsArray = Array.isArray(args) ? args : [args];
        const msg = argsArray.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const entry = `[${timestamp}] [${type}] ${msg}`;
        this.trace.push(entry);
    }

    execute(code) {
        this.trace = [];
        let result;
        try {
            result = vm.runInContext(code, this.context, { timeout: 1000 });
            if (result !== undefined) {
                this._log('RETURN', JSON.stringify(result));
            }
        } catch (err) {
            this._log('CRASH', err.message);
        }
        return {
            trace: this.trace,
            result: result
        };
    }
}

const engine = new EvalCore();

export function executeJS({ code }) {
    const output = engine.execute(code);
    return JSON.stringify({
        result: output.result,
        trace: output.trace
    }, null, 2);
}