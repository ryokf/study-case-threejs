import RAPIER, { MotorModel } from '@dimforge/rapier3d-compat'
import './style.css'
import * as THREE from 'three'
import { GLTFLoader, OrbitControls, RGBELoader } from 'three/examples/jsm/Addons.js'
import RapierDebugger from './debugger'

await RAPIER.init()
const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
const world = new RAPIER.World(gravity)
const dynamicBodies = []

const scene = new THREE.Scene()
new RGBELoader().load('environment/space_darker.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture
  scene.background = texture
  scene.environmentIntensity = 150
  scene.environment.mapping = THREE.EquirectangularReflectionMapping
})

const axisHelper = new THREE.AxesHelper(50)
scene.add(axisHelper)

const rapierDebugger = new RapierDebugger(scene, world);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)



const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement)
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const plane = new THREE.Mesh(
  new THREE.CylinderGeometry(100, 1, 100, 1024),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.1, metalness: 0.8 })
)
plane.name = 'plane'
plane.position.y = -50.5
plane.receiveShadow = true
plane.castShadow = true
scene.add(plane)
const planeBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(plane.position.x, plane.position.y, plane.position.z)
)
const planeShape = RAPIER.ColliderDesc.cylinder(50, 100).setCollisionGroups(65542)
world.createCollider(planeShape, planeBody)
let rearWheelJoints = [];
let frontWheelJoints = [];

let carBody;

new GLTFLoader().load('models/race.glb', (gltf) => {
  const bodyMesh = gltf.scene.getObjectByName('body')
  bodyMesh.position.y = 0
  bodyMesh.castShadow = true
  bodyMesh.receiveShadow = true
  scene.add(bodyMesh)

  const v = new THREE.Vector3()
  let positions = []
  bodyMesh.updateMatrixWorld(true)
  bodyMesh.traverse((o) => {
    if (o.type === 'Mesh') {
      const positionAtribute = o.geometry.getAttribute('position')
      for (let i = 0, l = positionAtribute.count; i < l; i++) {
        v.fromBufferAttribute(positionAtribute, i)
        v.applyMatrix4(o.parent.matrixWorld)
        positions.push(...v)
      }
    }
  })
  const bodyBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(bodyMesh.position.x, bodyMesh.position.y, bodyMesh.position.z).setCanSleep(false))
  const bodyShape = RAPIER.ColliderDesc.convexHull(new Float32Array(positions)).setMass(3).setRestitution(0).setFriction(3).setCollisionGroups(131073)
  world.createCollider(bodyShape, bodyBody)
  dynamicBodies.push([bodyMesh, bodyBody])


  let wheel = [];
  [
    'wheel-front-right',
    'wheel-front-left',
    'wheel-back-left',
    'wheel-back-right',
  ].map((name, index) => {
    wheel[index] = gltf.scene.getObjectByName(name)
    wheel[index].scale.x = 0.8
    wheel[index].receiveShadow = true
    wheel[index].castShadow = true
    if (index === 0 || index === 2) {
      wheel[index].position.x = 0.5

    } else {
      wheel[index].position.x = -0.5
    }
    scene.add(wheel[index])

    const vWheel = new THREE.Vector3()
    let positionWheels = []
    wheel[index].updateMatrixWorld(true)
    wheel[index].traverse((o) => {
      if (o.type === 'Mesh') {
        const positionAtribute = o.geometry.getAttribute('position')
        for (let i = 0, l = positionAtribute.count; i < l; i++) {
          vWheel.fromBufferAttribute(positionAtribute, i)
          vWheel.applyMatrix4(o.parent.matrixWorld)
          positionWheels.push(...vWheel)
        }
      }
    })

    const wheelBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.
        dynamic().
        setTranslation(index == 0 || index == 3 ? -0.1 : 0.1, 3, index == 0 || index == 1 ? -1 : 1)
    )

    const wheelShape = RAPIER.ColliderDesc.cylinder(0.1, 0.3)
      .setRotation(new THREE.Quaternion()
        .setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          Math.PI / 2
        )
      ).setTranslation(index == 0 || index == 3 ? -0.1 : 0.1, 0, 0).setCollisionGroups(262145)

    if (index === 0 || index === 1) {
      const axelBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(index == 0 || index == 3 ? -0.1 : 0.1, 3, 1))

      const axelShape = RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setRotation(new THREE.Quaternion()
        .setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          Math.PI / 2
        )
      ).setMass(0.25).setCollisionGroups(589823)

      const wheelAxel = world.createImpulseJoint(
        RAPIER.JointData.revolute(
          new RAPIER.Vector3(index == 0 ? -0.55 : 0.55, 0.1, 0.78),
          new RAPIER.Vector3(0, 0, 0),
          new RAPIER.Vector3(0, 1, 0)
        ),
        bodyBody,
        axelBody,
        true
      )
      wheelAxel.configureMotorModel(MotorModel.ForceBased)

      world.createImpulseJoint(
        RAPIER.JointData.revolute(
          new RAPIER.Vector3(0, 0, 0),
          new RAPIER.Vector3(0, 0, 0),
          new RAPIER.Vector3(1, 0, 0)
        ),
        axelBody,
        wheelBody,
        true
      )

      wheelShape.friction = 2.5
      wheelShape.mass = 0.5

      world.createCollider(axelShape, axelBody)
      dynamicBodies.push([new THREE.Object3D(), axelBody])

      frontWheelJoints.push(wheelAxel);
      wheelAxel.configureMotorPosition(0, 500, 50)
    }

    
    if (index === 2 || index === 3) {
      const wheelAxel = world.createImpulseJoint(
        RAPIER.JointData.revolute(
          new RAPIER.Vector3(index == 0 || index == 3 ? -0.55 : 0.55, 0.1, -0.73),
          new RAPIER.Vector3(0, 0, 0),
          new RAPIER.Vector3(index == 0 || index == 1 ? -1 : 1, 0, 0)
        ),
        bodyBody,
        wheelBody,
        true
      );

      rearWheelJoints.push(wheelAxel);

      // Konfigurasi default (kecepatan awal 0)
      wheelAxel.configureMotorVelocity(0, 1.0);

      wheelShape.friction = 1.5
      wheelShape.mass = 0.25
    }

    world.createCollider(wheelShape, wheelBody)
    dynamicBodies.push([wheel[index], wheelBody])

    
  })

  carBody = bodyMesh
  
  console.log(wheel)
})

const raycaster = new THREE.Raycaster()
const pickables = [plane]
const mouse = new THREE.Vector2()
plane.isPlane = true
const cubes = []
let clickTimeout;
let isLongClick = false

renderer.domElement.addEventListener("mousedown", (e) => {
  isLongClick = false

  clickTimeout = setTimeout(() => {
    isLongClick = true
  }, 500)
})

renderer.domElement.addEventListener("mouseup", (e) => {
  clearTimeout(clickTimeout);
  if (isLongClick) {
    return;
  }

  mouse.set(
    (e.clientX / renderer.domElement.clientWidth) * 2 - 1,
    -(e.clientY / renderer.domElement.clientHeight) * 2 + 1
  );

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(pickables, false);

  if (intersects.length > 0) {

    const clickedObject = intersects[0].object

    if (clickedObject.name === 'cube') {
      if (clickedObject.isPlane) return;
      clickedObject.scale.y += 0.5;
      clickedObject.position.y += 0.25;

      const bodyIndex = dynamicBodies.findIndex(([mesh]) => mesh === clickedObject);
      if (bodyIndex !== -1) {
        const [mesh, body] = dynamicBodies[bodyIndex];

        const newSize = {
          x: 0.5 * mesh.scale.x,
          y: 0.5 * mesh.scale.y,
          z: 0.5 * mesh.scale.z,
        };
        const newColliderDesc = RAPIER.ColliderDesc.cuboid(newSize.x, newSize.y, newSize.z).setMass(1);
        world.createCollider(newColliderDesc, body);
      }
    }
    else {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0, metalness: 0.5 })
      )
      cube.name = 'cube'
      cube.castShadow = true
      cube.receiveShadow = true
      cube.position.set(intersects[0].point.x, 0, intersects[0].point.z)
      pickables.push(cube)
      cubes.push(cube)

      const cubeBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cube.position.x, cube.position.y + 2, cube.position.z).setCanSleep(false))
      const cubeShape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(1)
      world.createCollider(cubeShape, cubeBody);
      dynamicBodies.push([cube, cubeBody])
    }
  }

});

renderer.domElement.addEventListener("mouseleave", () => {
  clearTimeout(clickTimeout);
});

// Membuat bola yang akan menjadi matahari
const sunGeometry = new THREE.SphereGeometry(5, 32, 32); // Ukuran bola
const sunMaterial = new THREE.MeshBasicMaterial({
  // shininess: 100,
  color: 0xffffff, // Warna matahari
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 20, 150); // Posisi matahari
scene.add(sun);

// Menambahkan cahaya di sekitar bola matahari
const sunLight = new THREE.DirectionalLight(0xddcc88, 15);
sunLight.target = plane;
// sunLight.isDirectionalLight = false;
sunLight.position.set(0, 0, 0); // Posisi sama dengan bola
sunLight.castShadow = true; // Bayangan diaktifkan
let d = 100
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sun.add(sunLight);

const textureLoader = new THREE.TextureLoader();
const glowTexture = textureLoader.load('/textures/glow.png');

const glowMaterial = new THREE.SpriteMaterial({
  map: glowTexture,
  color: 0xddcc88,
  blending: THREE.AdditiveBlending,
});

const glowSprite = new THREE.Sprite(glowMaterial);
glowSprite.scale.set(100, 100, 100);
sun.add(glowSprite);

//Variabel untuk orbit
const radius = 150; // Jarak orbit
let angle = 0; // Sudut awal

let carControls = {
  forward: false,  // W
  backward: false, // S
  left: false,     // A
  right: false     // D
};
// Event Listener untuk mendeteksi tombol ditekan
// Event Listener untuk mendeteksi tombol ditekan
window.addEventListener('keydown', (event) => {
  switch (event.key.toLowerCase()) {
    case 'w':
      carControls.forward = true;
      break;
    case 's':
      carControls.backward = true;
      break;
    case 'arrowleft':
      carControls.left = true;
      break;
    case 'arrowright':
      carControls.right = true;
      break;
  }
});

// Event Listener untuk mendeteksi tombol dilepaskan
window.addEventListener('keyup', (event) => {
  switch (event.key.toLowerCase()) {
    case 'w':
      carControls.forward = false;
      break;
    case 's':
      carControls.backward = false;
      break;
    case 'arrowleft':
      carControls.left = false;
      break;
    case 'arrowright':
      carControls.right = false;
      break;
  }
});



function animate() {
  carBody != null && camera.position.lerp(
    new THREE.Vector3(carBody.position.x , carBody.position.y + 4, carBody.position.z -10),
    0.1
  );
  carBody != null && camera.lookAt(carBody.position);

  cubes.map((cube) => {
    scene.add(cube)
  })

  angle += 0.005; // Kecepatan orbit

  // Hitung posisi bola menggunakan sin dan cos
  sun.position.x = plane.position.x + radius * Math.cos(angle);
  sun.position.z = plane.position.z + radius * Math.sin(angle);

  world.step()

  for (let i = 0, n = dynamicBodies.length; i < n; i++) {
    dynamicBodies[i][0].position.copy(dynamicBodies[i][1].translation())
    dynamicBodies[i][0].quaternion.copy(dynamicBodies[i][1].rotation())
  }

  if (carControls.forward) {
    rearWheelJoints.forEach((joint) => {
      joint.configureMotorVelocity(200, 3); // Kecepatan maju
    })
  } else if (carControls.backward) {
    rearWheelJoints.forEach((joint) => {
      joint.configureMotorVelocity(-100, 20); // Kecepatan mundur
    });
  } else {
    rearWheelJoints.forEach((joint) => {
      joint.configureMotorVelocity(0, 10); // Hentikan roda
    });
  }

  // Kontrol arah roda depan (A/D)
  frontWheelJoints.forEach((joint) => {
    if (carControls.left) {
      joint.configureMotorPosition(0.5, 500, 10); // Belok kiri
    } else if (carControls.right) {
      joint.configureMotorPosition(-0.5, 500, 10); // Belok kanan
    } else {
      joint.configureMotorPosition(0, 100, 10); // Lurus
    }
  });

  rapierDebugger.update()

  requestAnimationFrame(animate)
  renderer.render(scene, camera)
  controls.update()
}

animate()