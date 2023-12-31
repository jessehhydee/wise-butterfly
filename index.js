import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
  sizes,
  scene,
  camY,
  camZ,
  camera,
  renderer,
  raycaster,
  lastTimestamp,
  char,
  mixer,
  clock,
  centerTile,
  tileWidth,
  amountOfParticlesInTile,
  simplex,
  maxHeight,
  terrianColorRainbow,
  particleManipulator,
  dummyMatrix,
  particleMeshes,
  activeTile,
  prevActivePathPos,
  activePathPos,
  pathPositions,
  pathCurve,
  pathCurveCounter,
  currentPos,
  currentLookAt,
  currentLookAtLerpObj,
  sceneRendered;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene             = new THREE.Scene();
  scene.background  = new THREE.Color(0x0B1C25);
  scene.fog         = new THREE.Fog(0x0B1C25, 130, 170);

  camY    = 220,
  camZ    = -160;
  camera  = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 400);
  camera.position.set(0, camY, camZ);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  clock = new THREE.Clock()

  raycaster               = new THREE.Raycaster();
  raycaster.firstHitOnly  = true;
  lastTimestamp           = 0;
  pathPositions           = [];
  pathCurveCounter        = 30;
  sceneRendered           = false;
  currentPos              = new THREE.Vector3();
  currentLookAt           = new THREE.Vector3();
  currentLookAtLerpObj    = new THREE.Object3D();

  await createChar();
  setTileValues();
  createTile();
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`);
  createPath(5);
  resize();
  listenTo();
  render();

  sceneRendered = true;

};

const createChar = async () => {

  const gltfLoader  = new GLTFLoader();
  const model       = await gltfLoader.loadAsync('assets/char/scene.gltf');
  char              = model.scene;

  char.position.set(0, 30, 0);
  char.scale.set(1.8, 1.8, 1.8);

  mixer = new THREE.AnimationMixer(char);
  mixer
    .clipAction(model.animations[0])
    .setEffectiveTimeScale(1.4)
    .setEffectiveWeight(1)
    .setLoop(THREE.LoopRepeat)
    .fadeIn(1)
    .play();

  scene.add(char);

}

const setTileValues = () => {

  const centerTileFromTo = 40;

  centerTile = {
    xFrom:  -centerTileFromTo,
    xTo:    centerTileFromTo,
    yFrom:  -centerTileFromTo,
    yTo:    centerTileFromTo
  };
  tileWidth               = centerTileFromTo * 2; // diff between xFrom - xTo (not accounting for 0)
  amountOfParticlesInTile = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // +1 accounts for 0
  simplex                 = new SimplexNoise();
  maxHeight               = 30;
  terrianColorRainbow     = [ // Brightest (highest) -> dullest (lowest)
    new THREE.Color(0xd5ebf7),
    new THREE.Color(0xa8d4ed),
    new THREE.Color(0x82bde0),
    new THREE.Color(0x599bc2),
    new THREE.Color(0x31759D)
  ]
  particleManipulator     = new THREE.Object3D();
  dummyMatrix             = new THREE.Matrix4();
  particleMeshes          = [];

};

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + tileWidth,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + tileWidth
    }
  };

  const parsedCoords = JSON.parse(newActiveTile);

  setCenterTile(parsedCoords);

  tileYNegative();

  tileXPositive();

  tileYPositive();
  tileYPositive();

  tileXNegative();
  tileXNegative();

  tileYNegative();
  tileYNegative();

  setCenterTile(parsedCoords);

  cleanUpTiles();

  activeTile = newActiveTile;

};

const tileYNegative = () => {

  centerTile.yFrom -= tileWidth;
  centerTile.yTo -= tileWidth;
  createTile();

};

const tileYPositive = () => {

  centerTile.yFrom += tileWidth;
  centerTile.yTo += tileWidth;
  createTile();

};

const tileXNegative = () => {

  centerTile.xFrom -= tileWidth;
  centerTile.xTo -= tileWidth;
  createTile();

};

const tileXPositive = () => {

  centerTile.xFrom += tileWidth;
  centerTile.xTo += tileWidth;
  createTile();

};

const createTile = () => {

  const tileName = JSON.stringify({
    x: centerTile.xFrom,
    y: centerTile.yFrom
  });

  if(particleMeshes.some(el => el.name === tileName)) return; // Returns if tile already exists

  const tileToPosition = (tileX, height, tileY) => {
    return new THREE.Vector3((tileX + (tileY % 2) * 0.5) * 1.68, height, tileY * 1.535);
  };

  const setParticleMesh = (tileName) => {

    const geo   = new THREE.CircleGeometry(0.15, 4);
    const mat   = new THREE.MeshBasicMaterial({color: 0x31759D});
    const mesh  = new THREE.InstancedMesh(geo, mat, amountOfParticlesInTile);
    mesh.name   = tileName;
  
    return mesh;

  };

  const particle        = setParticleMesh(tileName);
  let   particleCounter = 0;
   
  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let e = centerTile.yFrom; e <= centerTile.yTo; e++) {

      let noise1    = (simplex.noise2D(i * 0.015, e * 0.015) + 1.3) * 0.3;
      noise1        = Math.pow(noise1, 1.2);
      let noise2    = (simplex.noise2D(i * 0.015, e * 0.015) + 1) * 0.75;
      noise2        = Math.pow(noise2, 1.2);
      const height  = noise1 * noise2 * maxHeight;

      const pos = tileToPosition(i, height, e);
      particleManipulator.position.set(pos.x, pos.y, pos.z);

      particleManipulator.updateMatrix();
      particle.setMatrixAt(particleCounter, particleManipulator.matrix);

      if(height > 20) particle.setColorAt(particleCounter, terrianColorRainbow[0]);
      else if(height > 15) particle.setColorAt(particleCounter, terrianColorRainbow[1]);
      else if(height > 10) particle.setColorAt(particleCounter, terrianColorRainbow[2]);
      else if(height > 5) particle.setColorAt(particleCounter, terrianColorRainbow[3]);
      else if(height > 0) particle.setColorAt(particleCounter, terrianColorRainbow[4]);

      particleCounter++;

      if(!particleMeshes.length)
        if(i === centerTile.xFrom && e === centerTile.yFrom) activePathPos = pos;

    }
  }

  scene.add(particle);
  particleMeshes.push(particle);

};

const cleanUpTiles = () => {

  for(let i = particleMeshes.length - 1; i >= 0; i--) {

    let tileCoords  = JSON.parse(particleMeshes[i].name);
    tileCoords      = {
      xFrom:  tileCoords.x,
      xTo:    tileCoords.x + tileWidth,
      yFrom:  tileCoords.y,
      yTo:    tileCoords.y + tileWidth
    }

    if(
      tileCoords.xFrom < centerTile.xFrom - tileWidth ||
      tileCoords.xTo > centerTile.xTo + tileWidth ||
      tileCoords.yFrom < centerTile.yFrom - tileWidth ||
      tileCoords.yTo > centerTile.yTo + tileWidth
    ) {

      const tile = scene.getObjectsByProperty('name', particleMeshes[i].name);
      for(let o = 0; o < tile.length; o++) cleanUp(tile[o]);

      particleMeshes.splice(i, 1);

    }

  }

}

const createPath = (pathSegments) => {

  const getSurroundingPositions = () => {

    const surroundingPositions = [];

    for(let i = 0; i < particleMeshes.length; i++) {
      for(let e = 0; e < amountOfParticlesInTile; e++) {
  
        particleMeshes[i].getMatrixAt(e, dummyMatrix);
        dummyMatrix.decompose(
          particleManipulator.position, 
          particleManipulator.quaternion, 
          particleManipulator.scale
        );

        const distanceTo = activePathPos.distanceTo(particleManipulator.position);
        if(distanceTo > 7 && distanceTo < 15)
          if(activePathPos !== particleManipulator.position && particleManipulator.position !== prevActivePathPos)
            surroundingPositions.push({
              pos:      JSON.stringify(particleManipulator.position),
              tileName: particleMeshes[i].name
            });
  
      }
    }

    return surroundingPositions;

  }
  
  const getDir = (from, to) => {

    if(!from) return 9;

    const relativePos = new THREE.Vector3();
    relativePos.subVectors(to, from);

    return new THREE.Vector3(0, 0, 1).dot(relativePos);

  }

  const getAvailalbePositions = (positions, dirForward) => {

    let availablePositions = [];

    for(let i = 0; i < positions.length; i++) {

      let pos   = JSON.parse(positions[i].pos);
      pos       = new THREE.Vector3(pos.x, pos.y, pos.z);
      const dir = getDir(activePathPos, pos);

      // Only accepts positions that are situated in front of the path.
      // Keeps path going in a similar direction.
      if((dir > dirForward - (Math.PI / 2.5) && dir < dirForward + (Math.PI / 2.5)) || dirForward === -1)
        availablePositions.push({
          pos:      pos,
          tileName: positions[i].tileName
        });

    }

    if(!availablePositions.length)
      availablePositions = positions.slice(positions.length / 2, positions.length);

    // Sorting from lowest to highest based on the y axis.
    // [0] will always be the lowaest of the collection.
    availablePositions.sort((a, b) => a.pos.y - b.pos.y);

    return availablePositions.slice(0, 2);

  };

  for(let i = 0; i < pathSegments; i++) {

    const surroundingPositions  = getSurroundingPositions();
    const dir                   = getDir(prevActivePathPos, activePathPos);
    const positions             = getAvailalbePositions(surroundingPositions, dir);

    prevActivePathPos = activePathPos;

    let tileName;
    if(JSON.stringify(activePathPos) !== JSON.stringify(positions[0])) {
      activePathPos = positions[0].pos;
      tileName      = positions[0].tileName;
    }
    else {
      activePathPos = positions[1].pos;
      tileName      = positions[1].tileName;
    }

    const elevatedActivePathPos = new THREE.Vector3(activePathPos.x, activePathPos.y + 5, activePathPos.z);
    pathPositions.push(elevatedActivePathPos);

    if(activeTile !== tileName) createSurroundingTiles(tileName);
    
  }

  const curve = new THREE.CatmullRomCurve3(pathPositions, false, 'centripetal', 0.9);
  pathCurve   = curve.getPoints(50);

};

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

};

const listenTo = () => {
  window.addEventListener('resize', resize.bind(this));
};

const camUpdate = () => {

  const calcIdealOffset = () => {
    const idealOffset = new THREE.Vector3(0, camY, camZ);
    idealOffset.applyQuaternion(char.quaternion);
    idealOffset.add(char.position);
    return idealOffset;
  }
  
  const calcIdealLookat = () => {
    const idealLookat = new THREE.Vector3(0, 10, 15);
    idealLookat.applyQuaternion(char.quaternion);
    idealLookat.add(char.position);
    return idealLookat;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat(); 

  currentPos.copy(idealOffset);
  currentLookAt.copy(idealLookat);

  camera.position.lerp(currentPos, 0.05);
  currentLookAtLerpObj.position.lerp(currentLookAt, 0.05);
  camera.lookAt(currentLookAtLerpObj.position);

  if(camY > 20)   camY -= 2;
  if(camZ < -24)  camZ += 2;

}

const charUpdate = () => {

  char.position.set(
    pathCurve[pathCurveCounter].x, 
    pathCurve[pathCurveCounter].y, 
    pathCurve[pathCurveCounter].z
  );
  char.lookAt(
    pathCurve[pathCurveCounter + 1].x, 
    pathCurve[pathCurveCounter + 1].y, 
    pathCurve[pathCurveCounter + 1].z
  );

  if(pathCurveCounter === 39) {
    pathCurveCounter = 30;
    pathPositions.shift();
    createPath(1);
  }
  else pathCurveCounter++;

  camUpdate();

};

const updateParticles = () => {

  for(let i = 0; i < particleMeshes.length; i++) {
    for(let e = 0; e < amountOfParticlesInTile; e++) {

      particleMeshes[i].getMatrixAt(e, dummyMatrix);
      dummyMatrix.decompose(
        particleManipulator.position, 
        particleManipulator.quaternion, 
        particleManipulator.scale
      );

      particleManipulator.lookAt(camera.position);

      particleManipulator.updateMatrix();
      particleMeshes[i].setMatrixAt(e, particleManipulator.matrix);

    }

    particleMeshes[i].instanceMatrix.needsUpdate = true;
  }

};

const render = (now) => {

  if(sceneRendered) {
    mixer.update(clock.getDelta());
    updateParticles();
  }

  if(now - lastTimestamp >= 10) {
    lastTimestamp = now;
    charUpdate();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this));

};

const cleanUp = (obj) => {

  if(obj.geometry && obj.material) {
    obj.geometry.dispose();
    obj.material.dispose();
  }
  else {
    obj.traverse(el => {
      if(el.isMesh) {
        el.geometry.dispose();
        el.material.dispose();
      }
    });
  }

  scene.remove(obj);
  renderer.renderLists.dispose();

};

setScene();
