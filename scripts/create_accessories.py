"""Wearables in original snake-head coordinates; exports convert Blender Z-up to glTF Y-up."""
import bpy,math,os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
teal=mat('Arctic teal wool',(.025,.26,.31));navy=mat('Deep navy wool',(.015,.05,.09));red=mat('Coral wool trim',(.8,.13,.095));cream=mat('Wool highlight',(.85,.9,.78));frame=mat('Sunglasses black frame',(.008,.012,.021),.27);lens=mat('Midnight blue lenses',(.025,.07,.115),.12,.25)
groups={};objects=[]
def begin(name):
 global objects
 objects=[];groups[name]=objects

def finish(o,name,m):
 o.name=name;o.data.materials.append(m);objects.append(o);return o

def orb(name,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=loc);o=bpy.context.object;o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,m)
def box(name,loc,dim,m,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('Soft edge','BEVEL');b.width=bevel;b.segments=3;o.data.use_auto_smooth=True;o.modifiers.new('Normals','WEIGHTED_NORMAL')
 return finish(o,name,m)
def torus(name,loc,major,minor,scale,m,rotation=None):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=major,minor_radius=minor,location=loc)
 o=bpy.context.object;o.scale=scale
 if rotation:o.rotation_euler=rotation
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,m)

begin('accessory-tundra')
orb('Beanie crown',(0,-.13,.98),(.43,.39,.39),teal)
torus('Folded navy brim',(0,-.13,.85),.37,.075,(1,.9,1.25),navy)
torus('Coral brim stripe',(0,-.13,.91),.376,.018,(1,.9,1),red)
# Raised ribs are individual soft loops visible at close camera distance.
for i in range(16):
 a=i*math.tau/16
 for j in range(3):
  z=.97+j*.085;r=.41*math.sqrt(max(.05,1-((z-.98)/.39)**2))
  orb('Knit stitch',(r*math.cos(a),-.13+r*.9*math.sin(a),z),(.013,.013,.03),teal)
orb('Beanie pompom',(0,-.13,1.40),(.14,.14,.14),red)
for i in range(9):
 a=i*math.tau/9;orb('Pompom tuft',(.1*math.cos(a),-.13+.1*math.sin(a),1.41),(.047,.047,.065),red)
torus('Scarf collar',(0,0,-.07),.29,.10,(1,1,1),red)
torus('Scarf upper stitch',(0,0,-.01),.32,.018,(1,1,1),cream)
o=box('Scarf long end',(.20,.24,-.37),(.18,.085,.61),red,.04);o.rotation_euler.y=-.16
o=box('Scarf short end',(-.02,.29,-.28),(.16,.08,.43),red,.035);o.rotation_euler.y=.12
for x,z in [(.23,-.60),(.00,-.43)]:box('Scarf cream stripe',(x,.29,z),(.16,.022,.04),cream,.008)

begin('accessory-desert')
for x,side in [(-.25,'L'),(.25,'R')]:
 torus('Shade frame '+side,(x,.595,.70),.205,.032,(1,1.12,1),frame,(math.pi/2,0,0))
 orb('Shade lens '+side,(x,.602,.70),(.187,.026,.209),lens)
box('Shades bridge',(0,.59,.73),(.13,.065,.055),frame,.025)
for x in [-.47,.47]:
 box('Shades temple',(x,.15,.76),(.06,.88,.065),frame,.025)
pivot=bpy.data.objects.new('ShadesPivot',None);bpy.context.scene.collection.objects.link(pivot)
for o in objects:o.parent=pivot
objects.append(pivot)

for name,group in groups.items():
 coll=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(coll)
 for o in group:
  for old in list(o.users_collection):old.objects.unlink(o)
  coll.objects.link(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]
 bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','assets',name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','accessories.blend'))
# Import the exact head geometry to check fit in previews, after exports/source save.
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public','assets','snake-head.glb'))
bpy.ops.object.camera_add(location=(2,4,2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.45))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.6
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world.color=(.20,.20,.20)
scene.render.resolution_x=850;scene.render.resolution_y=850;scene.render.resolution_percentage=100
bpy.ops.object.light_add(type='AREA',location=(1,3,5));bpy.context.object.data.energy=350;bpy.context.object.data.size=4
for theme in ['tundra','desert']:
 for name,group in groups.items():
  for o in group:o.hide_render=not name.endswith(theme)
 scene.render.filepath=os.path.join(ROOT,'assets','accessory-'+theme+'-preview.png');bpy.ops.render.render(write_still=True)
