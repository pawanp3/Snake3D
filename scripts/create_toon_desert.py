"""Smooth Toon variants; never overwrites Classic assets. Run in Blender 4.0+."""
import bpy,os,math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets')

def export(name,objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)

# Work from editable original geometry, retaining all transforms and eye parenting.
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets','snake3d.blend'))
keep={'snake-head','snake-neck','snake-body'}
belly=bpy.data.objects.get('NeckBelly')
if belly:bpy.data.objects.remove(belly,do_unlink=True)
for o in list(bpy.data.objects):
 if not any(c.name in keep for c in o.users_collection):bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.type!='MESH':continue
 if o.name.startswith(('EyeWhite','Pupil')):
  mod=o.modifiers.new('Smooth cartoon eyes','SUBSURF');mod.levels=1;mod.render_levels=1
 for m in o.modifiers:
  if m.type=='BEVEL':m.segments=7
 for p in o.data.polygons:p.use_smooth=True
 # Auto-smooth can produce seams on soft spheres; bevel meshes retain weighted normals.
 if not any(m.type=='BEVEL' for m in o.modifiers):o.data.use_auto_smooth=False

# Interpolate the existing neck center/radius samples into a smooth cubic loft.
neck=bpy.data.objects.get('UprightNeck')
rings=[(.12,-.56,.32),(.28,-.47,.36),(.48,-.29,.32),(.72,-.12,.28),(1.02,0,.27),(1.40,0,.29)]
verts=[];faces=[];steps=7;sides=48
for k in range(len(rings)-1):
 p0=Vector(rings[max(0,k-1)]);p1=Vector(rings[k]);p2=Vector(rings[k+1]);p3=Vector(rings[min(len(rings)-1,k+2)])
 for j in range(steps):
  t=j/steps;v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
  z,y,r=v
  for a in range(sides):
   angle=a*math.tau/sides;verts.append((r*math.cos(angle),y+r*math.sin(angle),z))
z,y,r=rings[-1]
for a in range(sides):angle=a*math.tau/sides;verts.append((r*math.cos(angle),y+r*math.sin(angle),z))
count=len(verts)//sides
for k in range(count-1):
 for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
faces.extend([tuple(reversed(range(sides))),tuple((count-1)*sides+j for j in range(sides))])
mesh=bpy.data.meshes.new('Smooth Toon neck loft');mesh.from_pydata(verts,[],faces);mesh.materials.append(neck.data.materials[0]);neck.data=mesh
for p in mesh.polygons:p.use_smooth=True
for m in bpy.data.materials:
 if not m.use_nodes:continue
 p=m.node_tree.nodes.get('Principled BSDF')
 if p:p.inputs['Roughness'].default_value=.36
for src,dst in [('snake-head','toon-head'),('snake-neck','toon-neck'),('snake-body','toon-body')]:export(dst,list(bpy.data.collections[src].objects))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','toon-snake.blend'))

# Reuse deterministic layout contract; execute authoring section only, never Classic export code.
source=open(os.path.join(ROOT,'scripts','create_landscapes.py')).read().split('for name,objects in groups.items():')[0]
ns={'__file__':os.path.join(ROOT,'scripts','create_landscapes.py')};exec(compile(source,'create_landscapes.py','exec'),ns)
groups=ns['groups'];palette=ns['palette'];shape=ns['shape']
selected=groups['landscape-desert']+groups['food-desert']
for o in list(bpy.data.objects):
 if o not in selected:bpy.data.objects.remove(o,do_unlink=True)
# Shared smooth sphere templates replace angular dunes/rocks; transforms unchanged.
roundmeshes={}
for o in selected:
 if o.type!='MESH':continue
 mat=o.data.materials[0]
 if o.name.startswith(('Dune','Desert rock','Fruit areole')):
  key=mat.name
  if key not in roundmeshes:
   bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12);tmp=bpy.context.object
   data=tmp.data;data.materials.append(mat);roundmeshes[key]=data;bpy.data.objects.remove(tmp,do_unlink=True)
  o.data=roundmeshes[key]
 if o.name.startswith('Prickly pear'):
  mod=o.modifiers.new('Silky fruit silhouette','SUBSURF');mod.levels=2;mod.render_levels=2
 if o.name.startswith(('Cactus','Upright cactus','Arm tip','Prickly pear')):
  for p in o.data.polygons:p.use_smooth=True
 if o.name.startswith('Cactus arm'):
  bpy.ops.object.select_all(action='DESELECT');o.data=o.data.copy();bpy.context.view_layer.objects.active=o;o.select_set(True)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
  mod=o.modifiers.new('Rounded cactus elbow','BEVEL');mod.width=.16;mod.segments=5;o.data.use_auto_smooth=True;o.modifiers.new('Soft normals','WEIGHTED_NORMAL')
 if o.name.startswith(('Dune','Desert rock')):
  for p in o.data.polygons:p.use_smooth=True
# Chunky sandstone landmarks enrich the low-camera horizon, fully outside clearing.
ns['current']=groups['landscape-desert']
for x,y,s in [(-20,15,1.3),(23,7,1.0),(8,-25,1.15),(-21,-15,.9)]:
 for k in range(3):
  o=shape('orb','Rounded sandstone stack',(x+.2*k,y,1.0+k*1.6*s),(2.2*s-k*.32,1.5*s,1.0*s),'rocklight')
 for dx in [-2.5,2.7]:shape('orb','Sandstone pebble',(x+dx,y+.5,.35),(.7,.55,.5),'rock')
# Deep coral fruit, warm gold sand, and jade cacti keep distinct readable color families.
for key,color in [('sand',(0.68,.38,.15)),('sandlight',(.91,.66,.32)),('desertgrid',(.78,.52,.25)),('rocklight',(.66,.30,.13)),('rock',(.49,.20,.085)),('cactus',(.10,.36,.22)),('cactuslight',(.18,.48,.29)),('pear',(.73,.045,.23))]:
 m=palette[key];m.diffuse_color=(*color,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.55
for name in ['landscape-desert','food-desert']:
 coll=bpy.data.collections.new('toon-'+name);bpy.context.scene.collection.children.link(coll)
 for o in groups[name]:
  for old in list(o.users_collection):old.objects.unlink(o)
  coll.objects.link(o)
 export('toon-'+name,groups[name])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','toon-desert.blend'))
# Scenery preview with the smooth upright character placed in the clearing.
for name in ['head','neck','body']:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(OUT,'toon-'+name+'.glb'))
 added=set(bpy.data.objects)-before
 for o in added:
  if o.parent is None:o.location+=Vector((-.5,1.5,1.4 if name=='head' else 0))
 if name=='body':
  for o in added:
   if o.parent is None:o.location.y-=1
for o in groups['food-desert']:o.location+=Vector((2.5,1.5,0))
bpy.ops.object.camera_add(location=(22,-28,24));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=51;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world.color=(.25,.25,.25)
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
bpy.ops.object.light_add(type='AREA',location=(4,-6,24));bpy.context.object.data.energy=5000;bpy.context.object.data.size=20
bpy.ops.object.light_add(type='SUN',rotation=(.4,-.4,-.3));bpy.context.object.data.energy=2
scene.render.filepath=os.path.join(ROOT,'assets','toon-desert-preview.png');bpy.ops.render.render(write_still=True)
cam.location=(5,10,5);cam.data.ortho_scale=6;cam.rotation_euler=(Vector((0,1,1))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=os.path.join(ROOT,'assets','toon-character-preview.png');bpy.ops.render.render(write_still=True)
