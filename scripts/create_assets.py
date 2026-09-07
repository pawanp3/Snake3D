import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in list(bpy.data.collections):
    if coll.name != 'Collection': bpy.data.collections.remove(coll)

def mat(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness; p.inputs['Metallic'].default_value=metallic
    return m
lime=mat('Lime enamel',(.48,.84,.075),.29)
light=mat('Soft yellow-green',(.75,.97,.25),.35)
dark=mat('Deep evergreen',(.017,.06,.037),.55)
eye=mat('Obsidian eyes',(.009,.018,.012),.14)
white=mat('Eye glints',(.91,1,.83),.2)
coral=mat('Coral fruit',(.98,.18,.105),.3)
leaf=mat('Leaf green',(.20,.52,.065),.55)
grid=mat('Grid lines',(.045,.115,.068),.8)
rail=mat('Boundary green',(.11,.24,.12),.35)

assets={}
def begin(name):
    global objects
    objects=[]; assets[name]=objects
def register(obj, material):
    obj.data.materials.append(material); objects.append(obj); return obj
def box(name, loc, scale, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name
    o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Rounded edges','BEVEL'); b.width=bevel; b.segments=3
        o.data.use_auto_smooth=True
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return register(o,material)
def sphere(name, loc, scale, material, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=8,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    for p in o.data.polygons: p.use_smooth=True
    return register(o,material)

begin('snake-head')
box('Head', (0,0,.39),(.85,.94,.72),lime,.22)
box('Muzzle',(0,.30,.28),(.70,.46,.32),light,.14)
for x,side in [(-.25,'L'),(.25,'R')]:
    sphere('EyeWhite_'+side,(x,.37,.70),(.205,.15,.235),white,24)
    pivot=bpy.data.objects.new('EyeSpin_'+side,None)
    bpy.context.scene.collection.objects.link(pivot); pivot.location=(x,.506,.70); objects.append(pivot)
    pupil=sphere('Pupil_'+side,(.035,.012,.025),(.092,.042,.12),eye,24)
    pupil.parent=pivot
    glint=sphere('PupilGlint_'+side,(.013,.049,.075),(.025,.012,.032),white)
    glint.parent=pivot
for x in [-.16,.16]: sphere('Nostril',(x,.476,.36),(.024,.018,.019),dark)
box('Smile',(0,.512,.25),(.39,.012,.018),dark,.008)

begin('snake-neck')
# Ring loft: upright upper neck curves back into the grounded trailing body.
verts=[]; faces=[]
rings=[(.12,-.56,.32),(.28,-.47,.36),(.48,-.29,.32),(.72,-.12,.28),(1.02,0,.27),(1.40,0,.29)]
for z,y,r in rings:
    for j in range(20):
        a=2*math.pi*j/20; verts.append((r*math.cos(a),y+r*math.sin(a),z))
for k in range(len(rings)-1):
    for j in range(20): faces.append((k*20+j,k*20+(j+1)%20,(k+1)*20+(j+1)%20,(k+1)*20+j))
faces.extend([tuple(reversed(range(20))),tuple((len(rings)-1)*20+j for j in range(20))])
mesh=bpy.data.meshes.new('Curved neck geometry'); mesh.from_pydata(verts,[],faces); mesh.update()
neck=bpy.data.objects.new('UprightNeck',mesh); bpy.context.scene.collection.objects.link(neck); register(neck,lime)
for p in mesh.polygons: p.use_smooth=True
sphere('GroundCollar',(0,-.63,.27),(.37,.49,.25),lime,24)
# A soft front belly panel makes the upright character readable from first-person surroundings.
sphere('NeckBelly',(0,.237,1.12),(.17,.04,.22),light,24)

begin('snake-body')
box('Body segment',(0,0,.33),(.79,.86,.61),lime,.22)
box('Dorsal accent',(0,-.06,.628),(.43,.32,.026),light,.025)

begin('food')
sphere('Fruit',(0,0,.36),(.34,.34,.35),coral)
box('Stem',(0,0,.745),(.055,.055,.17),dark,.017)
o=sphere('Leaf',(.14,0,.76),(.18,.08,.035),leaf); o.rotation_euler.y=-.3

begin('board')
box('Board base',(0,0,-.22),(20.65,20.65,.44),dark,.16)
for i in range(-10,11):
    box('Grid X %s'%i,(i,0,.005),(.014,20,.008),grid)
    box('Grid Y %s'%i,(0,i,.005),(20,.014,.008),grid)
for sign in [-1,1]:
    box('Boundary X',(sign*10.22,0,.13),(.24,20.6,.26),rail,.075)
    box('Boundary Y',(0,sign*10.22,.13),(20.6,.24,.26),rail,.075)

for name, group in assets.items():
    coll=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(coll)
    for obj in group:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        coll.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','assets',name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)

# Source file retains original asset origins and collections for easy editing.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','snake3d.blend'))

# Compose a separate, unsaved showcase scene from the exported-source geometry.
for obj in assets['snake-head']:
    if obj.parent is None: obj.location += Vector((-.5,2.5,1.4))
for obj in assets['snake-neck']: obj.location += Vector((-.5,2.5,0))
for obj in assets['snake-body']: obj.location += Vector((-.5,1.5,0))
for k in range(1,6):
    for src in assets['snake-body']:
        dup=src.copy(); dup.data=src.data.copy(); bpy.context.scene.collection.objects.link(dup)
        dup.location.y-=k
for obj in assets['food']: obj.location += Vector((2.5,3.5,0))
bpy.ops.object.camera_add(location=(17,-22,22)); cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=31; bpy.context.scene.camera=cam
for loc,power,size in [((0,2,16),2200,14),((-8,-4,9),1300,10)]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK'; o.data.size=size
    o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.world.color=(.16,.16,.16)
scene.render.resolution_x=1200; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=os.path.join(ROOT,'assets','preview.png')
bpy.ops.render.render(write_still=True)
cam.location=(5,11,6)
cam.rotation_euler=(Vector((-.25,1.5,1))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.ortho_scale=6.7
scene.render.filepath=os.path.join(ROOT,'assets','character-preview.png')
bpy.ops.render.render(write_still=True)
