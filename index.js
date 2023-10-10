import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
  sizes,
  scene,
  camera,
  renderer,
  raycaster,
  lastTimestamp,
  controls,
  char,
  centerTile,
  tileWidth,
  amountOfParticlesInTile,
  simplex,
  maxHeight,
  particleManipulator,
  dummyMatrix,
  particleMeshes,
  activeTile,
  prevActivePathPos,
  activePathPos,
  pathPositions,
  currentPos,
  currentLookAt,
  sceneRendered;

const setScene = async () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 400);
  camera.position.set(0, 30, 20);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false,
    alpha:      true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1));

  raycaster               = new THREE.Raycaster();
  raycaster.firstHitOnly  = true;
  lastTimestamp           = 0;
  pathPositions           = [];
  sceneRendered           = false;
  currentPos              = new THREE.Vector3();
  currentLookAt           = new THREE.Vector3();

  // setControls();
  createChar();
  setTileValues();
  createTile();
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`);
  createPath(10);
  resize();
  listenTo();
  render();

  sceneRendered = true;

};

const setControls = () => {

  controls                = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;

};

const createChar = () => {

  const geo = new THREE.CapsuleGeometry(1, 1, 4, 8); 
  const mat = new THREE.MeshBasicMaterial({color: 0x000000}); 
  char      = new THREE.Mesh(geo, mat); 
  char.position.set(0, 40, 0);
  scene.add(char);

}

const setTileValues = () => {

  const centerTileFromTo = 30;

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

    const geo   = new THREE.CircleGeometry(0.5, 4);
    const mat   = new THREE.MeshStandardMaterial({
      color:  0x31759D, 
      side:   THREE.DoubleSide
    });
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

  const setParticleMesh = () => {

    const geo   = new THREE.CircleGeometry(1.2, 4);
    const mat   = new THREE.MeshStandardMaterial({
      color:  0xffffff, 
      side:   THREE.DoubleSide
    });
    const mesh  = new THREE.InstancedMesh(geo, mat, pathSize);
  
    return mesh;

  };

  const createCurveWithTube = () => {

    const curve = new THREE.CatmullRomCurve3( [
      new THREE.Vector3( -10, 0, 10 ),
      new THREE.Vector3( -5, 5, 5 ),
      new THREE.Vector3( 0, 0, 0 ),
      new THREE.Vector3( 5, -5, 5 ),
      new THREE.Vector3( 10, 0, 10 )
    ] );
  
    const geo = new THREE.TubeGeometry(curve, 150, 2, 2, false);
    const mat = new THREE.MeshBasicMaterial({color: 0x00ff00});
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
  
  }

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

        if(activePathPos.distanceTo(particleManipulator.position) < 5)
          if(activePathPos !== particleManipulator.position && particleManipulator.position !== prevActivePathPos)
            surroundingPositions.push(JSON.stringify(particleManipulator.position));
  
      }
    }

    return surroundingPositions;

  }
  
  const getDir = (from, to) => {

    if(!from) return -1;

    const relativePos = new THREE.Vector3();
    relativePos.subVectors(to, from);

    return new THREE.Vector3(0, 0, 1).dot(relativePos);

  }

  const getAvailalbePositions = (positions, dirForward) => {

    const availablePositions = [];

    for(let i = 0; i < positions.length; i++) {

      let pos   = JSON.parse(positions[i]);
      pos       = new THREE.Vector3(pos.x, pos.y, pos.z);
      const dir = getDir(activePathPos, pos);

      // Only accepts positions that are situated in front of the path.
      // Keeps path going in a similar direction.
      if((dir > dirForward - (Math.PI / 2.5) && dir < dirForward + (Math.PI / 2.5)) || dirForward === -1)
        availablePositions.push(pos);

    }

    // Sorting from lowest to highest based on the y axis.
    // [0] will always be the lowaest of the collection.
    availablePositions.sort((a, b) => a.y - b.y);

    return availablePositions;

  };

  // const pathSize      = 30;
  // const pathParticle  = setParticleMesh();

  for(let i = 0; i < pathSegments; i++) {

    const surroundingPositions  = getSurroundingPositions();
    const dir                   = getDir(prevActivePathPos, activePathPos);
    const positions             = getAvailalbePositions(surroundingPositions, dir);
    prevActivePathPos           = activePathPos;

    if(JSON.stringify(activePathPos) !== JSON.stringify(positions[0])) activePathPos = positions[0];
    else activePathPos = positions[1];

    const elevatedActivePathPos = new THREE.Vector3(activePathPos.x, activePathPos.y + 5, activePathPos.z);
    pathPositions.push(elevatedActivePathPos);

    // particleManipulator.position.set(elevatedActivePathPos.x, elevatedActivePathPos.y, elevatedActivePathPos.z);
    // particleManipulator.updateMatrix();
    // pathParticle.setMatrixAt(i, particleManipulator.matrix);
    
  }

  // scene.add(pathParticle);

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
    const idealOffset = new THREE.Vector3(0, 3, 7);
    idealOffset.applyQuaternion(char.quaternion);
    idealOffset.add(char.position);
    return idealOffset;
  }
  
  const calcIdealLookat = () => {
    const idealLookat = new THREE.Vector3(0, 0.5, 10);
    idealLookat.applyQuaternion(char.quaternion);
    idealLookat.add(char.position);
    return idealLookat;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat(); 

  currentPos.copy(idealOffset);
  currentLookAt.copy(idealLookat);

  camera.position.lerp(currentPos, 0.09);
  camera.lookAt(currentLookAt);

}

const determineMoreTerrain = () => {

  raycaster.set(char.position, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObjects(particleMeshes);

  if(!intersects.length) return;
  if(activeTile !== intersects[0].object.name) createSurroundingTiles(intersects[0].object.name);

};

const charUpdate = () => {

  char.position.set(pathPositions[0].x, pathPositions[0].y, pathPositions[0].z);
  pathPositions.shift();
  createPath(1);

  camUpdate();
  determineMoreTerrain();

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

  if(sceneRendered) updateParticles();

  if(now - lastTimestamp >= 80) {
    lastTimestamp = now;
    charUpdate();
  }

  // controls.update();
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
