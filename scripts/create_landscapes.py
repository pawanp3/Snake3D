"""Deterministic Blender scenery and food exports; native Z-up converts to glTF Y-up."""
import bpy, math, os, random
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection': bpy.data.collections.remove(c)
random.seed(27)
cache={}; groups={}; current=[]
def material(name,hexcolor):
    c=tuple(int(hexcolor[i:i+2],16)/255 for i in (0,2,4))
    m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=.8
    return m
palette={k:material(k,v) for k,v in {
 'grass':'59964a','grasslight':'7daa5a','parkgrid':'7fb86c','bark':'745038','leaf':'337446','leaflight':'519344','flower':'f4be69','path':'c5af82','wood':'9f6945',
 'sand':'d6a668','sandlight':'e5bd80','desertgrid':'ebc792','rock':'b87554','rocklight':'c48a62','cactus':'4e8860','cactuslight':'75a266',
 'snow':'deedf0','snowlight':'eff6f4','tundragrid':'aecdd6','ice':'8ec9d8','iceblue':'609dae','pine':'709f9b',
 'apple':'df453c','stem':'594833','white':'fff4d5','pear':'d03980','pearspot':'f58ec0','berry':'f9b52e','berrylight':'ffd355','green':'638943',
}.items()}
def begin(name):
    global current
    current=[]; groups[name]=current

def shape(kind,name,loc,scale,mat):
    key=(kind,mat)
    if key not in cache:
        if kind=='box': bpy.ops.mesh.primitive_cube_add(size=1)
        elif kind=='ico': bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
        elif kind=='orb': bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1)
        elif kind=='cone': bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=1,radius2=0,depth=2)
        elif kind=='cylinder': bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=1,depth=2)
        o=bpy.context.object; o.data.materials.append(palette[mat]); cache[key]=o.data
        if kind=='orb':
            for p in o.data.polygons:p.use_smooth=True
    else:
        o=bpy.data.objects.new(name,cache[key]); bpy.context.scene.collection.objects.link(o)
    o.name=name; o.location=loc; o.scale=scale; current.append(o); return o

def board(theme,ground,top,line):
    shape('box','Surrounding terrain',(0,0,-.4),(90,90,.5),ground)
    shape('box','Playing clearing',(0,0,-.1),(20.5,20.5,.2),top)
    for i in range(-10,11):
        shape('box','Grid X',(i,0,.006),(.018,20,.009),line)
        shape('box','Grid Z',(0,i,.006),(20,.018,.009),line)
    for sign in [-1,1]:
        shape('box','Low border',(10.22*sign,0,.075),(.18,20.6,.15),line)
        shape('box','Low border',(0,10.22*sign,.075),(20.6,.18,.15),line)

def tree(x,y,s=1):
    shape('cylinder','Broadleaf trunk',(x,y,1.8*s),(.27*s,.27*s,2*s),'bark')
    for dx,dy,z,r in [(0,0,4,1.7),(-.7,.1,3.3,1.25),(.7,-.2,3.65,1.3)]:
        shape('ico','Leaf canopy',(x+dx*s,y+dy*s,z*s),(r*s,r*s,r*.9*s),random.choice(['leaf','leaflight']))

def cactus(x,y,s=1):
    shape('cylinder','Cactus stem',(x,y,1.6*s),(.33*s,.33*s,1.6*s),'cactus')
    shape('orb','Cactus crown',(x,y,3.15*s),(.33*s,.33*s,.33*s),'cactus')
    for side,z in [(-1,1.5),(1,2.1)]:
        shape('box','Cactus arm',(x+side*.5*s,y,z*s),(1*s,.4*s,.4*s),'cactuslight')
        shape('cylinder','Upright cactus arm',(x+side*.9*s,y,(z+.4)*s),(.21*s,.21*s,.5*s),'cactus')
        shape('orb','Arm tip',(x+side*.9*s,y,(z+.9)*s),(.21*s,.21*s,.21*s),'cactus')

def pine(x,y,s):
    shape('cylinder','Frosted trunk',(x,y,.8*s),(.15*s,.15*s,1*s),'bark')
    for z,r in [(1.4,1.1),(2.2,.85),(2.9,.6)]:
        shape('cone','Frosted pine',(x,y,z*s),(r*s,r*s,.9*s),'pine')
        shape('cone','Snow cap',(x,y,(z+.23)*s),(r*.8*s,r*.8*s,.72*s),'snowlight')

for theme in ['park','desert','tundra']:
    begin('landscape-'+theme)
    if theme=='park':
        board(theme,'grass','grasslight','parkgrid')
        for sign in [-1,1]:
            shape('box','Garden path',(sign*12,0,-.11),(1.4,80,.05),'path')
            shape('box','Garden path',(0,sign*12,-.11),(80,1.4,.05),'path')
        for i in range(38):
            a=2*math.pi*i/38; r=random.uniform(24,34)
            tree(math.cos(a)*r,math.sin(a)*r,random.uniform(.8,1.5))
        for x,y in [(-15,-6),(15,6),(-6,15),(6,-15)]:
            shape('box','Bench seat',(x,y,.65),(2,.65,.16),'wood')
            shape('box','Bench back',(x,y+.3,1.1),(2,.12,.65),'wood')
            for dx in [-.7,.7]:shape('box','Bench leg',(x+dx,y,.27),(.15,.45,.6),'bark')
        for i in range(70):
            a=random.random()*math.tau;r=random.uniform(18,24);x,y=math.cos(a)*r,math.sin(a)*r
            shape('ico','Flower',(x,y,.1),(.16,.16,.14),random.choice(['flower','white','apple']))
    elif theme=='desert':
        board(theme,'sand','sandlight','desertgrid')
        for i in range(22):
            a=math.tau*i/22;r=random.uniform(32,40)
            shape('ico','Dune',(math.cos(a)*r,math.sin(a)*r,-.5),(random.uniform(4,8),random.uniform(3,6),random.uniform(2,4)),'sandlight')
        for i in range(17):
            a=math.tau*i/17;r=random.uniform(18,26)
            cactus(math.cos(a)*r,math.sin(a)*r,random.uniform(.7,1.3))
        for i in range(25):
            a=random.random()*math.tau;r=random.uniform(17,30)
            shape('ico','Desert rock',(math.cos(a)*r,math.sin(a)*r,.2),(random.uniform(.4,1.4),random.uniform(.4,1.4),random.uniform(.5,1.8)),random.choice(['rock','rocklight']))
    else:
        board(theme,'snow','snowlight','tundragrid')
        for i in range(25):
            a=math.tau*i/25;r=random.uniform(22,35)
            shape('ico','Ice formation',(math.cos(a)*r,math.sin(a)*r,.5),(random.uniform(1.5,3.6),random.uniform(1.5,3),random.uniform(2,5)),random.choice(['ice','iceblue']))
        for i in range(20):
            a=random.random()*math.tau;r=random.uniform(19,32)
            shape('orb','Snowdrift',(math.cos(a)*r,math.sin(a)*r,-.1),(random.uniform(1.3,2.5),random.uniform(1,2.3),random.uniform(.5,1.2)),'snowlight')
        for i in range(13):
            a=math.tau*i/13;r=random.uniform(20,29);pine(math.cos(a)*r,math.sin(a)*r,random.uniform(.7,1.15))

    begin('food-'+theme)
    if theme=='park':
        shape('orb','Red apple',(0,0,.34),(.34,.32,.34),'apple')
        shape('cylinder','Apple stem',(0,0,.7),(.035,.035,.1),'stem')
        o=shape('orb','Apple leaf',(.15,0,.73),(.19,.085,.025),'green');o.rotation_euler.y=-.25
    elif theme=='desert':
        shape('orb','Prickly pear fruit',(0,0,.35),(.28,.28,.35),'pear')
        for j in range(12):
            a=j*math.tau/6;z=.23+(j//6)*.22
            shape('ico','Fruit areole',(.27*math.cos(a),.27*math.sin(a),z),(.026,.026,.03),'pearspot')
        shape('cone','Fruit crown',(0,0,.71),(.12,.12,.07),'flower')
    else:
        for j in range(7):
            a=j*math.tau/6;r=.18 if j<6 else 0
            shape('orb','Cloudberry drupelet',(r*math.cos(a),r*math.sin(a),.22 if j<6 else .39),(.17,.17,.18),'berrylight' if j%2 else 'berry')
        for j in range(3):
            a=j*math.tau/3
            o=shape('orb','Cloudberry sepals',(.19*math.cos(a),.19*math.sin(a),.07),(.23,.09,.035),'green');o.rotation_euler.z=a

for name,objects in groups.items():
    coll=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(coll)
    for o in objects:
        for old in list(o.users_collection):old.objects.unlink(o)
        coll.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','assets',name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)

# All original collections retain world-origin placement in the editable file.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','landscapes.blend'))
bpy.ops.object.camera_add(location=(27,-32,26));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=58
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world.color=(.3,.3,.3)
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
bpy.ops.object.light_add(type='AREA',location=(5,-5,24));bpy.context.object.data.energy=6500;bpy.context.object.data.size=22
bpy.ops.object.light_add(type='SUN',rotation=(.45,-.4,-.3));bpy.context.object.data.energy=2
for theme in ['park','desert','tundra']:
    for name,objects in groups.items():
        for o in objects:o.hide_render=not name.endswith(theme)
    scene.render.filepath=os.path.join(ROOT,'assets','landscape-'+theme+'-preview.png');bpy.ops.render.render(write_still=True)
