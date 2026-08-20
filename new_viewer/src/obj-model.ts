import * as pc from "playcanvas";

export class ObjModelParser implements pc.ResourceParser {
    private _device: pc.GraphicsDevice;
    private _defaultMaterial: pc.StandardMaterial;

    constructor(device: pc.GraphicsDevice) {
        this._device = device;
        this._defaultMaterial = new pc.StandardMaterial();
    }

    load(url: any, callback: pc.ResourceHandlerCallback, asset?: pc.Asset): void {}

    open(url: string, data: any, device?: pc.GraphicsDevice): any { return null; }

    canParse(context: any): boolean {
        return pc.path.getExtension(context.url) === '.obj';
    }

    parse(input: string, callback: (err: any, model?: pc.Model) => void): void {
        const parsed: Record<string, { verts: number[], normals: number[], uvs: number[] }> = {
            default: { verts: [], normals: [], uvs: [] }
        };
        let group = 'default';
        const lines = input.split('\n');
        const verts: number[] = [], normals: number[] = [], uvs: number[] = [];
        let i;

        for (i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);

            if (line[0] === 'v') {
                if (parts[0] === 'v') {
                    verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                } else if (parts[0] === 'vn') {
                    normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                } else if (parts[0] === 'vt') {
                    uvs.push(parseFloat(parts[1]), parseFloat(parts[2]));
                }
            } else if (line[0] === 'g' || line[0] === 'o' || line[0] === 'u') {
                group = parts[1];
                if (!parsed[group]) {
                    parsed[group] = { verts: [], normals: [], uvs: [] };
                }
            } else if (line[0] === 'f') {
                let p, r;
                if (parts.length === 4) {
                    for (p = 1; p < parts.length; p++) {
                        r = this._parseIndices(parts[p]);
                        parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]);
                        if (r[1] * 2 < uvs.length) {
                            parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]);
                        }
                        if (r[2] * 3 < normals.length) {
                            parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]);
                        }
                    }

                } else if (parts.length === 5) {
                    const order = [1, 2, 3, 3, 4, 1];
                    for (let o = 0; o < order.length; o++) {
                        p = order[o];
                        r = this._parseIndices(parts[p]);
                        parsed[group].verts.push(verts[r[0] * 3], verts[r[0] * 3 + 1], verts[r[0] * 3 + 2]);
                        if (r[1] * 2 < uvs.length) {
                            parsed[group].uvs.push(uvs[r[1] * 2], uvs[r[1] * 2 + 1]);
                        }
                        if (r[2] * 3 < normals.length) {
                            parsed[group].normals.push(normals[r[2] * 3], normals[r[2] * 3 + 1], normals[r[2] * 3 + 2]);
                        }
                    }
                } else {
                    console.error(`OBJ uses unsupported ${parts.length - 1}-gons`);
                }
            }
        }

        const model = new pc.Model();
        const groupNames = Object.keys(parsed);
        const root = new pc.GraphNode();
        
        for (i = 0; i < groupNames.length; i++) {
            const currentGroup = parsed[groupNames[i]];
            if (!currentGroup.verts.length) continue;
            if (currentGroup.verts.length > 65535) {
                console.warn('Warning: mesh with more than 65535 vertices');
            }

            const geom = new (pc as any).Geometry();
            geom.positions = currentGroup.verts;
            if (currentGroup.normals.length > 0) {
                geom.normals = currentGroup.normals;
            }
            if (currentGroup.uvs.length > 0) {
                geom.uvs = currentGroup.uvs;
            }

            const mesh = (pc as any).Mesh.fromGeometry(this._device, geom);
            const mi = new pc.MeshInstance(mesh, this._defaultMaterial, new pc.GraphNode());
            
            model.meshInstances.push(mi);
            root.addChild(mi.node);
        }
        
        model.graph = root;
        model.getGraph()?.syncHierarchy();
        callback(null, model);
    }

    private _parseIndices(str: string): number[] {
        const result: number[] = [];
        const indices = str.split('/');
        for (let i = 0; i < 3; i++) {
            if (indices[i]) {
                result[i] = parseInt(indices[i], 10) - 1;
            }
        }
        return result;
    }
}