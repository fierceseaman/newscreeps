'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

const username = Object.values(Game.structures).concat(Object.values(Game.creeps), Object.values(Game.powerCreeps), Object.values(Game.constructionSites))[0].owner.username;
var settings = {
    username: "FierceSeaman",
    allies: [ username],
    nukeStructures: [STRUCTURE_SPAWN, STRUCTURE_LAB, STRUCTURE_STORAGE, STRUCTURE_FACTORY,
        STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER],
    militaryBoosts:["XKHO2", "XGHO2", "XZHO2", "XLHO2", "XZH2O", "G"],
    civBoosts: ["XLH2O", "XUHO2", "XKH2O", "XUH2O", "XGH2O"],
    roomplanTime: 500,
    roomplanOffset: 155,
    cMTime: 400,
    cMOffset: 39,

    // market
    creditMin: 1000000, //min credits needed to start buying energy
    powerPrice: 8, // price we will pay for power
    upgradeBoostPrice: 15,
    powerBuyVolume: 5000, // amount of power we will buy at once
    processPower: true, //process power instead of selling it
    rcl8upgrade: true, //use excess energy to GCL pump at RCL8

    miningDisabled: ["W2N240"], //cities that will not attempt any highway mining
    ghodiumAmount: 7000, //threshold to stop producing ghodium
    boostsNeeded: 6000, // boost needed per city for us to boost creeps
    boostAmount: 5000, //threshold to stop producing boosts (add ~8000 to this and ghodium amount since this does not include ready to go boosts in terminal)
    wallHeight: [0, 0, 0, 30000, 100000, 500000, 2000000, 10000000],
    flagCleanup: 2000, //interval to update old flags
    depositFlagRemoveTime: 100000, //ticks after deposit flag is placed after which it should be removed regardless of deposit status
    addRemote: 0.6,
    removeRemote: 0.8,
    spawnFreeTime: 0.3, //amount of spawn time to be left open for miscellaneous activity
    bucket: {//minimum bucket thresholds
        resourceMining: 1000,
        repair: 3000, //repairing walls in a room
        processPower: 2200,
        colony: 4000, // building new rooms
        upgrade: 7000,
        energyMining: 4000,
        powerMining: 5000,
        mineralMining: 8000,
        // other constants we use with these
        range: 3000, //this keeps all power mining from shutting off at once.
        //If range + range/2 > 10000, there may be times where a mining flag is not placed even though the bucket is full
        rclMultiplier: 200, // scale: rcl0 = 5k, 1 => 4.8k etc
        growthLimit: 5, // average bucket growth limit over 100+ ticks
    },
    energy: {//energy thresholds
        repair: 60000,
        rcl8upgrade: 450000,
        processPower: 400000,
        powerMine: 450000
    },
    max: {
        upgraders: 6, // low rcl TODO: is this in use anymore?
        runners: 6, // low rcl
        builders: 3,
        transporters: 2,
        miners: 1, // rcl8 TODO: this should'nt be in use anymore
    },
    motion: {
        backRoadPenalty: 1.5
    },
    scouting: {
        assessTime: 1000,
        controllerRoom: [20000, 5000, 5000, 10000, 15000, 20000, 40000, 60000, 100000],//scout time based on rcl
        sk: 100000,
        highway: 10000000
    },
    minerUpdateTime: 50,
    powerMiningRange: 2, //manhattan distance that we can powermine (in rooms)
    miningRange: 7, //manhattan distance that we can deposit mine (in rooms)
    observerFrequency: 20, // how often each city scans a room

    // Profiling
    profileFrequency: 19,
    profileLength: 1,
    profileResultsLength: 50, // top 50 results are recorded

    // Stats
    statTime: 19,
    resourceStatTime: 19 * 50,
};

if(!Game.shard.name.includes("shard") || Game.shard.name == "shardSeason"){
    //botarena and swc custom settings
    settings.allies = ["Modus", "slowmotionghost", "Robalian", "Shibdib", username];
}

var settings_1 = settings;

var u = {
    getsetd: function (object, prop, defaultValue) {
        if (object[prop] === undefined) {
            object[prop] = defaultValue;
        }
        return object[prop]
    },

    getRoomCache: function(roomName) {
        const roomsCache = u.getsetd(Cache, "rooms", {});
        return u.getsetd(roomsCache, roomName, {})
    },

    getCreepCache: function(creepId) {
        const creepsCache = u.getsetd(Cache, "creeps", {});
        return u.getsetd(creepsCache, creepId, {})
    },

    getLabCache: function(labId){
        const labsCache = u.getsetd(Cache, "labs", {});
        return u.getsetd(labsCache, labId, {})
    },

    getWithdrawLocations: function(creep) {
        var city = creep.memory.city;
        var spawn = Game.spawns[city];
        var structures = spawn.room.find(FIND_STRUCTURES);
        return _.filter(structures, structure => structure.structureType == STRUCTURE_CONTAINER ||
                                                 structure.structureType == STRUCTURE_STORAGE ||
                                                 structure.structureType == STRUCTURE_TERMINAL)
    },

    isOnEdge: function(pos){//determine if a roomPos is on a room edge
        return pos.x == 0 || pos.x == 49 || pos.y == 0 || pos.y == 49
    },

    isNearEdge: function(pos){
        return pos.x <= 1 || pos.x >= 48 || pos.y <= 1 || pos.y >= 48
    },
    
    getTransferLocations: function(creep) {
        var city = creep.memory.city;
        var spawn = Game.spawns[city];
        var structures = spawn.room.find(FIND_STRUCTURES);
        return _.filter(structures, structure => structure.structureType == STRUCTURE_STORAGE ||
        //mineral miner error when in use                                        structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_CONTAINER)
    },
    
    getNextLocation: function(current, locations) {
        return (current + 1) % locations.length
    },

    getFactory: function(room) {
        if (room.controller.level < 7) return false

        // check for existing
        const roomCache = u.getsetd(Cache, room.name, {});
        const factory = Game.getObjectById(roomCache.factory);
        if (factory) return factory

        // look up uncached factory
        const factories = room.find(FIND_STRUCTURES,{ 
            filter: { structureType: STRUCTURE_FACTORY } 
        });
        if (factories.length) {
            roomCache.factory = factories[0].id;
            return factories[0]
        }
        return false
    },

    // Get the room's storage location. Priority for storage:
    // 1. Storage 2. Container 3. Terminal 4. Spawn
    getStorage: function(room) {
        // 1. Storage
        if (room.storage) return room.storage
        const roomCache = u.getsetd(Cache, room.name, {});

        // 2. Container
        const container = Game.getObjectById(roomCache.container);
        if (container) return container  
        const structures = room.find(FIND_STRUCTURES);
        const spawn = _.find(structures, struct => struct.structureType == STRUCTURE_SPAWN);
        const newContainer = spawn && _.find(structures, struct => struct.structureType == STRUCTURE_CONTAINER
            && struct.pos.inRangeTo(spawn, 3));
        if (newContainer) {
            roomCache.container = newContainer.id;
            return newContainer
        }

        // 3. Terminal
        if(room.terminal) return room.terminal
         
        // 4. Spawn   
        if (spawn) return spawn
        return false
    },
    
    getGoodPickups: function(creep) {
        var city = creep.memory.city;
        var localCreeps = u.splitCreepsByCity();
        var miners = _.filter(localCreeps[city], lcreep => lcreep.memory.role == "remoteMiner");
        var drops = _.flatten(_.map(miners, miner => miner.room.find(FIND_DROPPED_RESOURCES)));
        const runnersBySource = _.groupBy(_.filter(localCreeps[city]), c => c.memory.role == "runner", runner => runner.memory.targetId);
        const containers = _.map(miners, miner => _.find(miner.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType == STRUCTURE_CONTAINER));
        const goodContainers = _.filter(containers, 
            function(container){
                if(!container || container.store.getUsedCapacity() <= 0.5 * creep.store.getCapacity())
                    return false
                let store = container.store.getUsedCapacity();
                if(!runnersBySource[container.id])
                    return true
                for(const runner of runnersBySource[container.id])
                    store -= runner.store.getFreeCapacity();
                return store >= 0.5 * creep.store.getCapacity()
            });
        const goodDrops = _.filter(drops, 
            function(drop){
                if(drop.amount <= 0.5 * creep.store.getCapacity())
                    return false
                let amount = drop.amount;
                if(!runnersBySource[drop.id])
                    return true
                for(const runner of runnersBySource[drop.id])
                    amount -= runner.store.getFreeCapacity();
                return amount >= 0.5 * creep.store.getCapacity()
            }); 
        return goodDrops.concat(goodContainers)
    },
    
    iReservedOrOwn: function(roomName) {
        var room = Game.rooms[roomName];
        var hasController = room && room.controller;
        return hasController && (room.controller.my || ((room.controller.reservation) && (room.controller.reservation.username == settings_1.username)))
    },
    
    iReserved: function(roomName) {
        var room = Game.rooms[roomName];
        var hasController = room && room.controller;
        return hasController && ((room.controller.reservation) && (room.controller.reservation.username == settings_1.username))
    },

    iOwn: function(roomName) {
        var room = Game.rooms[roomName];
        var hasController = room && room.controller;
        return hasController && room.controller.my
    },
    
    enemyOwned: function(room) {
        return room.controller && room.controller.owner && !u.isFriendlyRoom(room)
    },
    
    getDropTotals: function() {
        var rooms = Game.rooms;
        var drops = _.flatten(_.map(rooms, room => room.find(FIND_DROPPED_RESOURCES)));
        return _.sum(_.map(drops, drop => drop.amount))
    },

    silenceCreeps: function() {
        if (Game.time % 50 == 0) {
            for (const creep of Object.values(Game.creeps)) {
                creep.notifyWhenAttacked(false);
            }
        }
    },
    
    splitCreepsByCity: function(){
        if(!Tmp.creepsByCity)
            Tmp.creepsByCity = _.groupBy(Game.creeps, creep => creep.memory.city);
        return Tmp.creepsByCity
    },
    
    splitRoomsByCity: function(){
        if(!Tmp.roomsByCity){
            const rooms = _.filter(Game.rooms, room => u.iReservedOrOwn(room.name));
            Tmp.roomsByCity = _.groupBy(rooms, room => room.memory.city);
        }
        return Tmp.roomsByCity
    },

    getMyCities: function() {
        if(!Tmp.myCities)
            Tmp.myCities = _.filter(Game.rooms, (room) => u.iOwn(room.name));
        return Tmp.myCities
    },

    getAvailableSpawn: function(spawns) {
        var validSpawns = _.filter(spawns, spawn => !spawn.spawning);
        if (validSpawns.length > 0) {
            return validSpawns[0]
        } else {
            return null
        }
    },
    
    updateCheckpoints: function(creep) {
        if (Game.time % 50 == 0  && !u.enemyOwned(creep.room)) {
            if (creep.hits < creep.hitsMax) {
                return
            }
            if (!creep.memory.checkpoints) {
                creep.memory.checkpoints = [];
            }
            creep.memory.checkpoints.push(creep.pos);
            if (creep.memory.checkpoints.length > 2) {
                creep.memory.checkpoints.shift();
            }
        }
    },

    highwayMoveSettings: function(maxOps, swampCost, startPos, endPos, avoidEnemies) {
        return {
            range: 1,
            plainCost: 1,
            swampCost: swampCost,
            maxOps: maxOps,
            maxRooms: 64,
            roomCallback: function(roomName) {
                const startRoom = roomName == startPos.roomName;
                const isHighway = u.isHighway(roomName);
                const isBad = avoidEnemies && Cache[roomName] && Cache[roomName].enemy;
                const nearStart = u.roomInRange(2, startPos.roomName, roomName);
                const nearEnd = u.roomInRange(2, endPos.roomName, roomName);

                if (((!isHighway && !nearStart && !nearEnd) || isBad) && !startRoom) {
                    return false
                }

                const costs = new PathFinder.CostMatrix();
                return isHighway ? costs : _.map(costs, cost => cost * 3)
            }
        }
    },

    findMultiRoomPath: function(startPos, endPos) {
        return PathFinder.search(startPos, {pos: endPos, range: 1 }, 
            u.highwayMoveSettings(10000, 1, startPos, endPos))
    },

    // E0,E10... W0, 10 ..., N0, N10 ...
    isHighway: function(roomName) {
        const coords = roomName.match(/[0-9]+/g);
        const x = Number(coords[0]);
        const y = Number(coords[1]);
        return (x % 10 == 0) || (y % 10 == 0)
    },

    isIntersection: function(roomName){
        const coords = roomName.match(/[0-9]+/g);
        const x = Number(coords[0]);
        const y = Number(coords[1]);
        return (x % 10 == 0) && (y % 10 == 0)
    },

    getAllRoomsInRange: function(d, rooms) {
        const size = 2 * d + 1;
        return _(rooms)
            .map(u.roomNameToPos)
            .map(pos => u.generateRoomList(pos[0] - d, pos[1] - d, size, size))
            .flatten()
            .value()
    },

    roomInRange: function(range, roomName1, roomName2) {
        const pos1 = u.roomNameToPos(roomName1);
        const pos2 = u.roomNameToPos(roomName2);
        return (Math.abs(pos1[0] - pos2[0]) <= range) && (Math.abs(pos1[1] - pos2[1]) <= range)
    },

    roomNameToPos: function(roomName) {
        const quad = roomName.match(/[NSEW]/g);
        const coords = roomName.match(/[0-9]+/g);
        const x = Number(coords[0]);
        const y = Number(coords[1]);
        return [
            quad[0] === "W" ? -1 - x : x,
            quad[1] === "S" ? -1 - y : y
        ]
    },

    roomPosToName: function(roomPos) {
        const x = roomPos[0];
        const y = roomPos[1];
        return (x < 0 ? "W" + String(-x - 1) : "E" + String(x)) +
            (y < 0 ? "S" + String(-y - 1) : "N" + String(y))
    },

    isFriendlyRoom: function(room){
        if(room.controller 
            && (room.controller.my
                || (room.controller.owner 
                    && settings_1.allies.includes(room.controller.owner.username))
                || (room.controller.reservation
                    && settings_1.allies.includes(room.controller.reservation.username)))){
            return true
        } else {
            return false
        }
    },

    findHostileCreeps: function(room){
        return _.filter(room.find(FIND_HOSTILE_CREEPS).concat(room.find(FIND_HOSTILE_POWER_CREEPS)), c => !settings_1.allies.includes(c.owner.username))
    },

    findHostileStructures: function(room){
        if(!u.isFriendlyRoom(room)){
            return _.filter(room.find(FIND_STRUCTURES), s => s.hits)
        }
        return []
    },

    generateRoomList: function(minX, minY, sizeX, sizeY) {
        return _(Array(sizeX)).map((oldX, i) => {
            return _(Array(sizeY)).map((oldY, j) => {
                return u.roomPosToName([minX + i, minY + j])
            }).value()
        }).flatten().value()
    },

    findExitPos: function(roomName, exit){
        if(Game.rooms[roomName]){
            return Game.rooms[roomName].find(exit)
        }
        const exits = [];
        let constSide = 0;
        let loopVar = "x";
        let constVar = "y";
        switch(exit){
        case FIND_EXIT_TOP:
            constSide = 0;
            loopVar = "x";
            constVar = "y";
            break
        case FIND_EXIT_BOTTOM:
            constSide = 49;
            loopVar = "x";
            constVar = "y";
            break
        case FIND_EXIT_RIGHT:
            constSide = 49;
            loopVar = "y";
            constVar = "x";
            break
        case FIND_EXIT_LEFT:
            constSide = 0;
            loopVar = "y";
            constVar = "x";
            break
        }
        const terrain = new Room.Terrain(roomName);
        for(let i = 0; i < 49; i++){
            const newPos = {};
            newPos[loopVar] = i;
            newPos[constVar] = constSide;
            if(!terrain.get(newPos.x, newPos.y)){//terrain is plain
                exits.push(new RoomPosition(newPos.x, newPos.y, roomName));
            }
        }
        return exits
    },

    requestBoosterFill: function(spawn, boosts){
        if(!spawn.memory.ferryInfo || !spawn.memory.ferryInfo.labInfo){
            return
        }
        const receivers = spawn.memory.ferryInfo.labInfo.receivers;
        for(const mineral of boosts){
            let receiver = _.find(Object.keys(receivers), lab => receivers[lab].boost == mineral);
            if(!receiver){
                receiver = _.find(Object.keys(receivers), lab => !receivers[lab].boost);
            }
            if(receiver){
                receivers[receiver].boost = mineral;
                const lab = Game.getObjectById(receiver);
                if(lab){
                    receivers[receiver].fill = Math.ceil((LAB_MINERAL_CAPACITY - (lab.store[mineral] || 0))/1000);
                }
            }
        }
    },

    isNukeRampart: function(roomPos){
        const structures = roomPos.lookFor(LOOK_STRUCTURES);
        if(_.find(structures, struct => settings_1.nukeStructures.includes(struct.structureType))){
            return true
        }
        return false
    },

    //combine store of all cities given
    empireStore: function(cities){
        const empireStore = {};
        for (const resource of RESOURCES_ALL){
            if(!cities.length){
                empireStore[resource] = 0;
            } else {
                empireStore[resource] = _.sum(cities, city => {
                    const terminal = city.terminal;
                    const terminalAmount = (terminal && terminal.store.getUsedCapacity(resource)) || 0;
                    const storage = city.storage;
                    const storageAmount = (storage && storage.store.getUsedCapacity(resource)) || 0;

                    return (terminal && terminalAmount + storageAmount) || 0
                });
            }
        }
        return empireStore
    },

    cacheBoostsAvailable: function(cities) {
        const empireStore = u.empireStore(cities);
        const cityCount = _.filter(cities, city => city.controller.level >= 7).length || 1;
        const boosts = settings_1.civBoosts.concat(settings_1.militaryBoosts);
        const boostQuantityRequired = settings_1.boostsNeeded * cityCount;
        const boostsAvailable = _(boosts)
            .filter(boost => empireStore[boost] >= boostQuantityRequired)
            .value();
        Cache.boostsAvailable = boostsAvailable;
        Cache.boostCheckTime = Game.time;
    },

    boostsAvailable: function(role, room) {
        if (!Cache.boostsAvailable || Game.time - Cache.boostCheckTime > 1000) {
            const cities = u.getMyCities();
            u.cacheBoostsAvailable(cities);
        }
        const boostsAvailable = Cache.boostsAvailable || [];
        return _(role.boosts).every(boost => boostsAvailable.includes(boost)) 
            || (room && room.terminal && _(role.boosts).every(boost => room.terminal.store[boost] >= LAB_MINERAL_CAPACITY))
    },

    checkRoom: function(creep){
        if(creep.hits < creep.hitsMax*0.8){
            //search for hostile towers. if there are towers, room is enemy
            const tower = _.find(u.findHostileStructures(creep.room), s => s.structureType == STRUCTURE_TOWER);
            if(tower){
                if(!Cache[creep.room.name]){
                    Cache[creep.room.name] = {};
                }
                Cache[creep.room.name].enemy = true;
            }
        }
    },

    logDamage: function(creep, targetPos, rma = false){
        u.getsetd(Tmp, creep.room.name,{});
        u.getsetd(Tmp[creep.room.name], "attacks",[]);
        const ranged = creep.getActiveBodyparts(RANGED_ATTACK);
        const damageMultiplier = creep.memory.boosted ? (ranged * 4) : ranged;
        if(rma){
            for(let i = creep.pos.x - 3; i <= creep.pos.x + 3; i++){
                for(let j = creep.pos.y - 3; j <= creep.pos.y + 3; j++){
                    if(i >= 0 && i <= 49 && j >= 0 && j <= 49){
                        const distance = Math.max(Math.abs(creep.pos.x - i),Math.abs(creep.pos.y - j));
                        switch(distance){
                        case 0: 
                        case 1:
                            Tmp[creep.room.name].attacks.push({x: i, y: j, damage: damageMultiplier * 10});
                            break
                        case 2:
                            Tmp[creep.room.name].attacks.push({x: i, y: j, damage: damageMultiplier * 4});
                            break
                        case 3:
                            Tmp[creep.room.name].attacks.push({x: i, y: j, damage: damageMultiplier});
                            break
                        }
                    }
                }
            }
        } else {
            Tmp[creep.room.name].attacks.push({x: targetPos.x, y: targetPos.y, damage: damageMultiplier * RANGED_ATTACK_POWER});
        }

    },

    getCreepDamage: function(creep, type){
        const creepCache = u.getCreepCache(creep.id);
        if(creepCache[type + "damage"])
            return creepCache[type + "damage"]
        const damageParts = creep.getActiveBodyparts(type);
        const boostedPart = _.find(creep.body, part => part.type == type && part.boost);
        const multiplier = boostedPart ? BOOSTS[type][boostedPart.boost][type] : 1;
        const powerConstant = type == RANGED_ATTACK ? RANGED_ATTACK_POWER : ATTACK_POWER;
        creepCache[type + "damage"] = powerConstant * multiplier * damageParts;
        return creepCache[type + "damage"]
    },

    generateCreepName: function(counter, role){
        return role + "-" + counter
    },

    removeFlags: function(roomName){
        for(const flagName of Object.keys(Memory.flags)){
            if(Memory.flags[flagName].roomName == roomName){
                delete Memory.flags[flagName];
            }
        }
    },

    generateFlagName: function(baseName){
        let counter = 0;
        while(Memory.flags[baseName + counter]){
            counter++;
        }
        return baseName + counter
    },

    cleanFlags: function(){
        if(!Memory.flags) return
        for(const flagName of Object.keys(Memory.flags)){
            Memory.flags[flagName].removeTime = Memory.flags[flagName].removeTime || Game.time + 20000;
            if(Game.time > Memory.flags[flagName].removeTime){
                delete Memory.flags[flagName];
            }
        }
    },

    placeFlag: function(flagName, roomPos, removeTime = null){
        Memory.flags[flagName] = roomPos;
        Memory.flags[flagName].removeTime = removeTime;
    }
};

var utils = u;

var fact = {

    runFactory: function(city) {
        fact.initFactoryMem(city);
        if(Game.spawns[city].memory.ferryInfo.factoryInfo.produce === "dormant" || !Game.spawns[city].memory.ferryInfo.factoryInfo.produce){
            if(Game.time % 100 != 0){
                return
            }
            Game.spawns[city].memory.ferryInfo.factoryInfo.produce = RESOURCE_ORGANISM;//will result in reset
        }
        const factory = fact.findFactory(city);
        if(!factory){
            return
        }
        fact.react(factory, city);
        //TODO: decision making, requesting minerals etc.

    },

    initFactoryMem: function(city){
        if(!Game.spawns[city].memory.ferryInfo){
            Game.spawns[city].memory.ferryInfo = {};
        }
        if(!Game.spawns[city].memory.ferryInfo.factoryInfo){
            Game.spawns[city].memory.ferryInfo.factoryInfo = {};
            Game.spawns[city].memory.ferryInfo.comSend = [];//list of commodities to be delivered as soon as the terminal is ready
            Game.spawns[city].memory.ferryInfo.factoryInfo.produce = null;
            Game.spawns[city].memory.ferryInfo.factoryInfo.factoryLevel = null;
            Game.spawns[city].memory.ferryInfo.factoryInfo.transfer = [];
        }
    },

    findFactory: function(city){
        const structures = Game.spawns[city].room.find(FIND_MY_STRUCTURES);
        const factory = _.find(structures, struct => struct.structureType === STRUCTURE_FACTORY);
        if(!factory){
            return 0
        }
        if(factory.level !== Game.spawns[city].memory.ferryInfo.factoryInfo.factoryLevel){
            if(!Game.spawns[city].memory.ferryInfo.factoryInfo.factoryLevel){
                //schedule removal of all commodities
                fact.removeJunk(city, Game.spawns[city].room.terminal, factory.level);
            }
            Game.spawns[city].memory.ferryInfo.factoryInfo.factoryLevel = factory.level;
        }
        return factory
    },

    react: function(factory, city){
        if(!factory.cooldown && Game.spawns[city].memory.ferryInfo.factoryInfo.produce){
            const produce = Game.spawns[city].memory.ferryInfo.factoryInfo.produce;
            const components = Object.keys(COMMODITIES[produce].components);
            let go = true;
            for (let i = 0; i < components.length; i++) {
                if(COMMODITIES[produce].components[components[i]] > factory.store[components[i]]){
                    go = false;
                }
            }
            if(go){
                factory.produce(produce);
            } else {
                if(Game.time % 10 === 0){
                    fact.restock(factory, city, produce);// maybe run this every 10 to save cpu?
                }
            }
            return
        }
        if(Game.time % 10 === 0 && Game.spawns[city].memory.ferryInfo.factoryInfo.produce){
            const produce = Game.spawns[city].memory.ferryInfo.factoryInfo.produce;
            const components = Object.keys(COMMODITIES[produce].components);
            let go = true;
            for (let i = 0; i < components.length; i++) {
                if(COMMODITIES[produce].components[components[i]] > factory.store[components[i]]){
                    go = false;
                }
            }
            if(!go){
                fact.restock(factory, city, produce);
            }
        }
    },

    restock: function(factory, city, produce){
        if(!Game.spawns[city].memory.ferryInfo.factoryInfo.transfer.length){
            if(factory.store[produce]){//factory just finished producing, must be emptied before choosing new produce, then getting filled
                Game.spawns[city].memory.ferryInfo.factoryInfo.transfer.push([produce, 0, factory.store[produce]]);
                return
            }
            //don't choose new produce if ferry just deposited (ferry will be isNearTo and storeing stuff)
            const ferry = _.find(factory.room.find(FIND_MY_CREEPS), creep => creep.memory.role === "ferry");
            if(ferry &&  _.sum(ferry.store) > 0 && ferry.pos.isNearTo(factory.pos)) {
                return
            }
            fact.chooseProduce(factory, city);
            return
        }
    },

    checkTerminal: function(factory, city){
        const products = _.filter(Object.keys(COMMODITIES), key => COMMODITIES[key].level === factory.level);
        for (var i = 0; i < products.length; i++) {
            const components = _.without(Object.keys(COMMODITIES[products[i]].components), RESOURCE_ENERGY);
            const rate = fact.findRateLimit(components, products[i]);
            let go = true;
            for (var j = 0; j < components.length; j++) {
                const room = Game.spawns[city].room;
                if((COMMODITIES[products[i]].components[components[j]] * rate) > room.terminal.store[components[j]]){
                    go = false;
                }
            }
            if(go){
                fact.requestComponents(city, components, products[i]);
                Game.spawns[city].memory.ferryInfo.factoryInfo.produce = products[i];
                return true
            }
        }
    },

    chooseProduce: function(factory, city){
        const terminal = Game.spawns[city].room.terminal;
        if(!terminal){
            Game.spawns[city].memory.ferryInfo.factoryInfo.produce = "dormant";
            return
        }
        if(factory.level >= 1){
            //check terminal for resources needed to produce same level comms
            if(fact.checkTerminal(factory, city)){
                return
            }
            //otherwise go dormant
            Game.spawns[city].memory.ferryInfo.factoryInfo.produce = "dormant";
        } else {
            //make 5k of each base resource commodity (in increments of 200)
            const bars = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR,
                RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER, RESOURCE_GHODIUM_MELT];
            for(let i = 0; i < bars.length; i++){
                if(terminal.store[bars[i]] < 3000){
                    Game.spawns[city].memory.ferryInfo.factoryInfo.produce = bars[i];
                    const components = _.without(Object.keys(COMMODITIES[bars[i]].components), RESOURCE_ENERGY); //ferry shouldn't deliver energy
                    fact.requestComponents(city, components, bars[i]);
                    return
                }
            }
            //if excess base mineral, process it
            for(let i = 0; i < bars.length; i++){
                const components = _.without(Object.keys(COMMODITIES[bars[i]].components), RESOURCE_ENERGY);
                if(terminal.store[components[0]] >= 9000){
                    if(components[0] == RESOURCE_GHODIUM && terminal.store[components[0]] < 20000){
                        continue
                    }
                    Game.spawns[city].memory.ferryInfo.factoryInfo.produce = bars[i];
                    const coms = _.without(Object.keys(COMMODITIES[bars[i]].components), RESOURCE_ENERGY); //ferry shouldn't deliver energy
                    fact.requestComponents(city, coms, bars[i]);
                    return
                }
            }
            //make base commodities i.e. wire, cell etc.
            const baseComs = [RESOURCE_CONDENSATE, RESOURCE_ALLOY, RESOURCE_CELL, RESOURCE_WIRE];
            const rawComs = [RESOURCE_SILICON, RESOURCE_METAL, RESOURCE_BIOMASS, RESOURCE_MIST];
            for(let i = 0; i < baseComs.length; i++){
                const components = _.without(Object.keys(COMMODITIES[baseComs[i]].components), RESOURCE_ENERGY);
                const commodity = _.intersection(components, rawComs);
                if(terminal.store[commodity] >= 1000){
                    //produce it
                    Game.spawns[city].memory.ferryInfo.factoryInfo.produce = baseComs[i];
                    fact.requestComponents(city, components, baseComs[i]);
                    return
                }

            }
            //activate dormant mode
            Game.spawns[city].memory.ferryInfo.factoryInfo.produce = "dormant";
        }
    },

    findRateLimit: function(components, produce){//return number of cycles we can do
        let rateLimit = 0; //determine rate limit(resources cannot be transferred in quantities greater than 1k)
        for(let i = 0; i < components.length; i++){
            const needed = COMMODITIES[produce].components[components[i]];
            if(rateLimit < needed){
                rateLimit = needed;
            }
        }
        //use rate limit to determine how much of each component is needed
        const productionNum = _.floor(1000/rateLimit);//number of cycles we can run per charter
        return productionNum
    },

    requestComponents: function(city, components, produce){
        const productionNum = fact.findRateLimit(components, produce);
        for(let i = 0; i < components.length; i++){
            const requestAmount = COMMODITIES[produce].components[components[i]] * productionNum;
            Game.spawns[city].memory.ferryInfo.factoryInfo.transfer.push([components[i], 1, requestAmount]);
        }

    },

    removeJunk: function(city, terminal){
        const coms = _.without(_.difference(Object.keys(COMMODITIES), Object.keys(REACTIONS)), RESOURCE_ENERGY);
        const unleveledFactory = _.find(Game.structures, struct => struct.structureType == STRUCTURE_FACTORY
                 && struct.my && !struct.level && struct.room.terminal && struct.room.controller.level >= 7);
        if (!unleveledFactory) {
            return
        }
        const destination = unleveledFactory.room.name;
        for(var i = 0; i < Object.keys(terminal.store).length; i++){
            if(_.includes(coms, Object.keys(terminal.store)[i])){
                //send com to a level 0 room
                Game.spawns[city].memory.ferryInfo.comSend.push([Object.keys(terminal.store)[i], terminal.store[Object.keys(terminal.store)[i]], destination]);
            }
        }
    }

};
var factory = fact;

var cM = {
    runManager: function(cities){
        // cache boosts
        utils.cacheBoostsAvailable(cities);

        //group cities by factory level
        const citiesByFactoryLevel = cM.groupByFactoryLevel(cities);
        const levelCache = _.mapValues(citiesByFactoryLevel, utils.empireStore);
        const terminalCache = cM.storeCacheByCity(cities);

        let requestQueue = cM.getTopTier(citiesByFactoryLevel);
        //push all top tier resources into queue

        while(requestQueue.length){
            console.log(requestQueue);
            const requestedProduct = requestQueue.shift();
            const quantities = cM.getOrderQuantities(requestedProduct);
            const clearedToShip = cM.getOrderStatus(quantities, levelCache);

            if(clearedToShip){
                //attempt to find a receiver
                const destination = cM.getDestination(requestedProduct, citiesByFactoryLevel);
                if(destination){
                    //schedule deliveries
                    cM.scheduleDeliveries(citiesByFactoryLevel, destination, terminalCache, quantities, levelCache);
                }
            } else {
                //request whatever we're missing
                requestQueue = requestQueue.concat(cM.getMissingComponents(quantities, levelCache));
            }
        }
    },

    getTopTier: function(citiesByFactoryLevel){
        const levels = Object.keys(citiesByFactoryLevel);
        const topTier = _.max(levels);
        console.log(topTier);
        return _.filter(Object.keys(COMMODITIES), c => COMMODITIES[c].level == topTier && cM.isCommodity(c))
    },

    isCommodity: function(commodity){
        return _.find(Object.keys(COMMODITIES[commodity].components), comp => comp != RESOURCE_ENERGY
            && COMMODITIES[comp]
            && !REACTIONS[comp]
            && _.find(Object.keys(COMMODITIES[comp].components), compComp => compComp != RESOURCE_ENERGY
                && !REACTIONS[compComp]))
    },

    getOrderQuantities: function(product) {
        const compInfo = _.omit(COMMODITIES[product].components, RESOURCE_ENERGY);
        const components = Object.keys(compInfo);
        const rate = factory.findRateLimit(components, product); //find rate limit, and use that to find quantity of each resource needed 
        return _(compInfo).mapValues(amount => amount * rate).value()
    },

    getOrderStatus: function(quantities, levelCache){
        //bool, check if we have enough of all components to ship
        for(const component of Object.keys(quantities)){
            const compLvl = COMMODITIES[component].level || 0;
            const cache = levelCache[compLvl];
            const empireHasEnough = cache && cache[component] >= quantities[component];
            if(!empireHasEnough){
                return false
            }

        }
        return true
    },

    getDestination: function(product, citiesByFactoryLevel){
        //return roomName. destination must have less than 2k of all commodities and correct factoryLevel.
        console.log(product);
        const prodLvl = COMMODITIES[product].level;
        const components = _.without(Object.keys(COMMODITIES[product].components), RESOURCE_ENERGY);
        const destinations = _.filter(citiesByFactoryLevel[prodLvl], city => 
            _.every(components, comp => !city.terminal.store[comp] || city.terminal.store[comp] < 2000));
        const destination = destinations.length ? _.sample(destinations).name : null;
        return destination
    },

    getMissingComponents: function(quantities, levelCache){
        //return array of components that we don't have enough of and are isCommodity
        const missingComponents = [];
        for(const component of Object.keys(quantities)){
            const compLvl = COMMODITIES[component].level || 0;
            const cache = levelCache[compLvl];
            const empireHasEnough = cache && cache[component] >= quantities[component];
            if(!empireHasEnough && compLvl > 0){
                missingComponents.push(component);
            }
        }
        return missingComponents
    },

    storeCacheByCity: function(cities) {
        const termCities = _(cities).filter(city => city.terminal).value();
        return _(termCities)
            .map("name")
            .zipObject(termCities)
            .mapValues(city => _.clone(city.terminal.store))
            .value()
    },

    scheduleDeliveries: function(factCities, destination, terminalCache, quantities, levelCache){
        for(const component of Object.keys(quantities)){
            const compLvl = COMMODITIES[component].level || 0;
            const sourceCities = factCities[compLvl];
            let quantity = quantities[component];

            for (const source of sourceCities) { //for each city at the relevant level, send resources until the quantity is satisfied
                const memory = Game.spawns[source.memory.city].memory;
                const sourceAmount = terminalCache[source.name][component] || 0;
                if (quantity == 0) {
                    break
                } else if (sourceAmount > 0) {
                    const amount = Math.min(quantity, sourceAmount);
                    // schedule terminal transfer
                    const ferryInfo = utils.getsetd(memory, "ferryInfo", {});
                    const comSend = utils.getsetd(ferryInfo, "comSend", []);
                    comSend.push([component, amount, destination]);
                    // update values to reflect move
                    terminalCache[source.name][component] -= amount;
                    levelCache[compLvl][component] -= amount;
                    terminalCache[destination][component] += amount;
                    quantity -= amount;
                }
            }
            if(quantity){
                Game.notify("Problem sending " + component + " to " + destination);
            }
        }
    },

    groupByFactoryLevel: function(cities){
        const citiesWithFactory = _.filter(cities, city => city.terminal && utils.getFactory(city));
        const citiesByFactoryLevel =
            _.groupBy(citiesWithFactory, city => utils.getFactory(city).level || 0);
        return citiesByFactoryLevel
    },

    cleanCities: function(cities){
        const citiesByFactoryLevel = cM.groupByFactoryLevel(cities);
        for(const level of Object.values(citiesByFactoryLevel)){
            for(const city of level){
                const factory = utils.getFactory(city);
                const memory = Game.spawns[city.memory.city].memory;
                if(memory.ferryInfo.factoryInfo.produce == "dormant"){
                    //empty factory (except for energy)
                    for(const resource of Object.keys(factory.store)){
                        if(resource != RESOURCE_ENERGY){
                            memory.ferryInfo.factoryInfo.transfer.push([resource, 0, factory.store[resource]]);
                        }
                    }
                    if(factory.level){//only leveled factories need to send back components
                        for(const resource of Object.keys(city.terminal.store)){
                            //send back components
                            if(COMMODITIES[resource] 
                                && !REACTIONS[resource] 
                                && resource != RESOURCE_ENERGY 
                                && COMMODITIES[resource].level != factory.level){
                                const comLevel = COMMODITIES[resource].level || 0;
                                const receiver = citiesByFactoryLevel[comLevel][0].name;

                                const amount = city.terminal.store[resource];
                                const ferryInfo = utils.getsetd(memory, "ferryInfo", {});
                                const comSend = utils.getsetd(ferryInfo, "comSend", []);
                                comSend.push([resource, amount, receiver]);
                            }
                        }
                    }
                }
            }
        }

    }
};
var commodityManager = cM;

//http://screeps.dissi.me/
var template = {
    "wallDistance": 4,
    "dimensions": {"x":13, "y":11},
    "centerOffset": {"x":6, "y":5},
    "offset": {"x":13, "y":12},
    "exits": [{"x":18,"y":12},{"x":20,"y":12},{"x":13,"y":17},{"x":19,"y":22},{"x":21,"y":22},{"x":24,"y":22},{"x":25,"y":20},{"x":25,"y":17}], // road spots on edge of template
    "buildings": {
        "spawn":{
            "pos":[{"x":19,"y":14},{"x":19,"y":13},{"x":19,"y":12}]
        },
        "storage":{"pos":[{"x":19,"y":16}]},
        "terminal":{"pos":[{"x":20,"y":17}]},
        "extension":{
            "pos":[ // X: 13-25, Y: 12-22.
                {"x":17,"y":14},{"x":17,"y":13},{"x":17,"y":12},{"x":16,"y":14},{"x":21,"y":14},{"x":15,"y":16},{"x":15,"y":13},
                {"x":14,"y":14},{"x":16,"y":12},{"x":15,"y":12},{"x":14,"y":12},{"x":13,"y":12},{"x":13,"y":13},{"x":13,"y":14},
                {"x":23,"y":13},{"x":25,"y":13},{"x":21,"y":13},{"x":13,"y":15},{"x":13,"y":16},{"x":14,"y":16},{"x":21,"y":12},
                {"x":22,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":23,"y":12},{"x":23,"y":15},{"x":25,"y":15},{"x":24,"y":12},
                {"x":25,"y":12},{"x":22,"y":12},{"x":23,"y":16},{"x":24,"y":16},{"x":25,"y":16},{"x":23,"y":17},{"x":13,"y":18},
                {"x":14,"y":18},{"x":15,"y":18},{"x":24,"y":18},{"x":25,"y":18},{"x":13,"y":19},{"x":15,"y":19},{"x":25,"y":19},
                {"x":13,"y":20},{"x":14,"y":20},{"x":16,"y":20},{"x":17,"y":20},{"x":18,"y":20},{"x":20,"y":20},{"x":13,"y":21},
                {"x":15,"y":21},{"x":17,"y":21},{"x":19,"y":21},{"x":25,"y":21},{"x":13,"y":22},{"x":14,"y":22},{"x":15,"y":22},
                {"x":16,"y":22},{"x":17,"y":22},{"x":18,"y":22},{"x":20,"y":22}
            ]
        },
        "road":{
            "pos":[
                {"x":18,"y":12},{"x":20,"y":12},{"x":14,"y":13},{"x":16,"y":13},{"x":18,"y":13},{"x":20,"y":13},{"x":22,"y":13},{"x":24,"y":13},
                {"x":15,"y":14},{"x":18,"y":14},{"x":20,"y":14},{"x":23,"y":14},{"x":14,"y":15},{"x":16,"y":15},{"x":18,"y":15},{"x":19,"y":15},
                {"x":20,"y":15},{"x":22,"y":15},{"x":24,"y":15},{"x":17,"y":16},{"x":18,"y":16},{"x":20,"y":16},{"x":21,"y":16},{"x":13,"y":17},
                {"x":14,"y":17},{"x":15,"y":17},{"x":16,"y":17},{"x":17,"y":17},{"x":19,"y":17},{"x":21,"y":17},{"x":22,"y":17},{"x":24,"y":17},
                {"x":25,"y":17},{"x":17,"y":18},{"x":18,"y":18},{"x":20,"y":18},{"x":21,"y":18},{"x":23,"y":18},{"x":14,"y":19},{"x":16,"y":19},
                {"x":18,"y":19},{"x":19,"y":19},{"x":20,"y":19},{"x":21,"y":19},{"x":24,"y":19},{"x":15,"y":20},{"x":19,"y":20},{"x":22,"y":20},
                {"x":25,"y":20},{"x":14,"y":21},{"x":16,"y":21},{"x":18,"y":21},{"x":20,"y":21},{"x":23,"y":21},{"x":19,"y":22},{"x":21,"y":22},
                {"x":24,"y":22}
            ]
        },
        "lab":{
            "pos":[
            //first two labs must be reactors to be identified properly
                {"x":22,"y":21},{"x":23,"y":20},{"x":22,"y":19},{"x":23,"y":19},{"x":21,"y":20},
                {"x":24,"y":20},{"x":21,"y":21},{"x":24,"y":21},{"x":22,"y":22},{"x":23,"y":22}
            ]
        },
        "tower":{
            "pos":[{"x":17,"y":15},{"x":16,"y":16},{"x":22,"y":16},{"x":16,"y":18},{"x":22,"y":18},{"x":17,"y":19}]
        },
        "powerSpawn":{"pos":[{"x":18,"y":17}]},
        "nuker":{"pos":[{"x":15,"y":15}]},
        "link":{"pos":[{"x":19,"y":18}]},
        "observer":{"pos":[{"x":25,"y":22}]},
        "factory":{"pos":[{"x":21,"y":15}]}
    },
    "qrCoords": [
        [
            {"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":3,"y":0},{"x":4,"y":0},{"x":5,"y":0},{"x":6,"y":0},
            {"x":10,"y":0},{"x":12,"y":0},{"x":14,"y":0},{"x":15,"y":0},{"x":16,"y":0},{"x":17,"y":0},{"x":18,"y":0},{"x":19,"y":0},
            {"x":20,"y":0}
        ],
        [
            {"x":20,"y":1},{"x":14,"y":1},{"x":12,"y":1}, {"x":10,"y":1},{"x":8,"y":1},{"x":6,"y":1},{"x":0,"y":1}
        ],
        [
            {"x":0,"y":2},{"x":2,"y":2},{"x":3,"y":2},{"x":4,"y":2},{"x":6,"y":2},{"x":8,"y":2},{"x":10,"y":2},{"x":11,"y":2},{"x":14,"y":2},
            {"x":16,"y":2},{"x":17,"y":2},{"x":18,"y":2},{"x":20,"y":2}
        ],
        [
            {"x":20,"y":3},{"x":18,"y":3},{"x":17,"y":3},{"x":16,"y":3},
            {"x":14,"y":3},{"x":12,"y":3},{"x":6,"y":3},{"x":4,"y":3},{"x":3,"y":3},{"x":2,"y":3},{"x":0,"y":3}
        ],
        [
            {"x":0,"y":4},{"x":2,"y":4},
            {"x":3,"y":4},{"x":4,"y":4},{"x":6,"y":4},{"x":8,"y":4},{"x":9,"y":4},{"x":10,"y":4},{"x":12,"y":4},{"x":14,"y":4},{"x":16,"y":4},
            {"x":17,"y":4},{"x":18,"y":4},{"x":20,"y":4}
        ],
        [
            {"x":20,"y":5},{"x":14,"y":5},{"x":10,"y":5},{"x":9,"y":5},{"x":8,"y":5},{"x":6,"y":5},{"x":0,"y":5}
        ],
        [
            {"x":0,"y":6},{"x":1,"y":6},{"x":2,"y":6},{"x":3,"y":6},{"x":4,"y":6},{"x":5,"y":6},{"x":6,"y":6},{"x":8,"y":6},
            {"x":10,"y":6},{"x":12,"y":6},{"x":14,"y":6},{"x":15,"y":6},{"x":16,"y":6},{"x":17,"y":6},{"x":18,"y":6},{"x":19,"y":6},{"x":20,"y":6}
        ],
        [
            {"x":8,"y":7}
        ],
        [
            {"x":0,"y":8},{"x":1,"y":8},{"x":3,"y":8},{"x":6,"y":8},{"x":7,"y":8},{"x":10,"y":8},{"x":11,"y":8},{"x":12,"y":8},
            {"x":14,"y":8},{"x":15,"y":8},{"x":16,"y":8},{"x":18,"y":8},{"x":19,"y":8}
        ],
        [
            {"x":20,"y":9},{"x":19,"y":9},{"x":18,"y":9},{"x":17,"y":9},
            {"x":16,"y":9},{"x":13,"y":9},{"x":11,"y":9},{"x":10,"y":9},{"x":9,"y":9},{"x":5,"y":9},{"x":4,"y":9},{"x":3,"y":9},{"x":2,"y":9},
            {"x":2,"y":9},{"x":1,"y":9},{"x":0,"y":9}
        ],
        [
            {"x":1,"y":10},{"x":2,"y":10},{"x":4,"y":10},{"x":6,"y":10},{"x":7,"y":10},{"x":8,"y":10},
            {"x":9,"y":10},{"x":11,"y":10},{"x":12,"y":10},{"x":17,"y":10},{"x":18,"y":10},{"x":20,"y":10}
        ],
        [
            {"x":19,"y":11},{"x":17,"y":11},
            {"x":16,"y":11},{"x":14,"y":11},{"x":12,"y":11},{"x":7,"y":11},{"x":5,"y":11},{"x":4,"y":11},{"x":1,"y":11}
        ],
        [
            {"x":0,"y":12},{"x":1,"y":12},{"x":2,"y":12},{"x":5,"y":12},{"x":6,"y":12},{"x":8,"y":12},{"x":12,"y":12},{"x":15,"y":12},
            {"x":17,"y":12},{"x":20,"y":12}
        ],
        [
            {"x":20,"y":13},{"x":15,"y":13},{"x":14,"y":13},{"x":13,"y":13},{"x":12,"y":13},{"x":8,"y":13}
        ],
        [
            {"x":0,"y":14},{"x":1,"y":14},{"x":2,"y":14},{"x":3,"y":14},{"x":4,"y":14},{"x":5,"y":14},{"x":6,"y":14},{"x":8,"y":14},{"x":9,"y":14},
            {"x":10,"y":14},{"x":12,"y":14},{"x":13,"y":14},{"x":14,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":18,"y":14},{"x":19,"y":14}
        ],
        [
            {"x":20,"y":15},{"x":19,"y":15},{"x":17,"y":15},{"x":10,"y":15},{"x":6,"y":15},{"x":0,"y":15}
        ],
        [
            {"x":0,"y":16},{"x":2,"y":16},
            {"x":3,"y":16},{"x":4,"y":16},{"x":6,"y":16},{"x":12,"y":16},{"x":13,"y":16},{"x":16,"y":16}
        ],
        [
            {"x":20,"y":17},{"x":19,"y":17},
            {"x":18,"y":17},{"x":17,"y":17},{"x":16,"y":17},{"x":13,"y":17},{"x":12,"y":17},{"x":11,"y":17},{"x":10,"y":17},{"x":9,"y":17},
            {"x":8,"y":17},{"x":6,"y":17},{"x":4,"y":17},{"x":3,"y":17},{"x":2,"y":17},{"x":0,"y":17}
        ],
        [
            {"x":0,"y":18},{"x":2,"y":18},{"x":3,"y":18},
            {"x":4,"y":18},{"x":6,"y":18},{"x":11,"y":18},{"x":12,"y":18},{"x":14,"y":18},{"x":15,"y":18},{"x":16,"y":18},{"x":20,"y":18}
        ],
        [
            {"x":16,"y":19},{"x":15,"y":19},{"x":13,"y":19},{"x":10,"y":19},{"x":9,"y":19},{"x":8,"y":19},{"x":6,"y":19},{"x":0,"y":19}
        ],
        [
            {"x":0,"y":20},{"x":1,"y":20},{"x":2,"y":20},{"x":3,"y":20},{"x":4,"y":20},{"x":5,"y":20},{"x":6,"y":20},{"x":8,"y":20},{"x":9,"y":20},
            {"x":11,"y":20},{"x":15,"y":20},{"x":17,"y":20},{"x":19,"y":20}
        ]
    ]
};

var m$1 = {
    BoundingBox: class {
        constructor(top, left, bottom, right, thickness = 2) {
            this.top = top; // minY
            this.left = left; // minX
            this.bottom = bottom; // maxY
            this.right = right; // maxX
            this.thickness = thickness;
        }
    },

    //newMove will override all long and short distance motion
    // optional bounding box of form: [top, left, bottom, right]
    newMove: function(creep, endPos,  range = 0, avoidEnemies = true, boundingBox = null){
        //check for cached path and cached route
        const ccache = utils.getCreepCache(creep.id);
        const routeVerified = m$1.checkRoute(creep, endPos);
        const pathVerified = m$1.checkPath(creep, endPos);
        //if creep thinks it moved last tick, but pos is the same, it's stuck/needs recalc
        const moveFailed = (ccache.lastPos 
            && ccache.lastPos.isEqualTo(creep.pos) 
            && ccache.lastMove 
            && ccache.lastMove == Game.time - 1);
        //if everything is good to go, MBP
        if(pathVerified && routeVerified && !moveFailed){ 
            //check for portals
            if(!ccache.lastPos || ccache.lastPos.roomName == creep.pos.roomName
                || !utils.isIntersection(creep.pos.roomName)){//if new room is an intersection, check for portals
                const result = creep.moveByPath(ccache.path);
                if(result == OK){
                    ccache.lastMove = Game.time;
                    ccache.lastPos = creep.pos;
                }
                if([OK, ERR_TIRED, ERR_BUSY, ERR_NO_BODYPART].includes(result)){//MBP returns OK, OR a different error that we don't mind (like ERR_TIRED)
                    return
                }
            }
        }
        //recalc needed
        if(ccache.pathFail > 2){
            if(Game.time % 50 != 0){
                return
            }
            ccache.pathFail = 0; 
        }
        const routeFound = 
            m$1.getRouteAndPath(creep, endPos, avoidEnemies, range, boundingBox);

        if(routeFound){//if pathing successful, MBP
            if(creep.moveByPath(ccache.path) == OK){
                ccache.lastMove = Game.time;
                ccache.lastPos = creep.pos;
                const nextPos = ccache.path[0];
                if(Game.rooms[nextPos.roomName]){
                    const creeps = nextPos.lookFor(LOOK_CREEPS).concat(nextPos.lookFor(LOOK_POWER_CREEPS));
                    if(creeps.length && creeps[0].my && creeps[0].memory.moveStatus != "static"){
                        const scache = utils.getCreepCache(creeps[0].id);
                        if(!scache.lastMove || scache.lastMove < (Game.time - 1)){
                            creeps[0].move(creeps[0].pos.getDirectionTo(creep.pos));
                        }
                    }
                }

            }
        } else {
            Log.info(`Pathing failure at ${creep.pos}`);
            if(ccache.pathFail){
                ccache.pathFail++;
                return
            }
            ccache.pathFail = 1;
        }
    },

    //bool, returns success of pathfinding ops
    getRouteAndPath: function(creep, endPos, avoidEnemies, range, boundingBox){
        const ccache = utils.getCreepCache(creep.id);

        //if creep is in same room as target, path to target. Otherwise, path to nearest exit in the right direction
        const sameRoom = creep.pos.roomName == endPos.roomName;
        if(sameRoom){
            const maxRooms = 1;
            const goal = {pos: endPos, range: range};
            const result = m$1.getPath(creep, goal, avoidEnemies, maxRooms, boundingBox);
            if(!result.incomplete){
                ccache.route = null; //no route since creep is in required room already
                ccache.path = result.path;
                ccache.endPos = endPos;
                return true
            } else {
                return false
            }
        } else {
            const route = m$1.getRoute(creep.pos.roomName, endPos.roomName, avoidEnemies);
            if(route == ERR_NO_PATH){
                Log.info(`No route from ${creep.pos} to ${endPos}`);
                return false
            }
            //we can assume that the route has length 
            //since we already checked to make sure that we are not in the destination room
            //we can also assume that we are outside the first room in the route, since we just recalculated
            let goals;
            if(route.length < 3){
                goals = {pos: endPos, range: range};
            } else {
                const exits = utils.findExitPos(route[1].room, route[2].exit);
                goals = _.map(exits, function(e) {
                    return { pos: e, range: 0 } 
                });
            }
            const maxRooms = 16;
            const result = m$1.getPath(creep, goals, avoidEnemies, maxRooms, boundingBox);
            if(!result.incomplete){
                ccache.route = route;
                ccache.path = result.path;
                ccache.endPos = endPos;
                return true
            } else {
                return false
            }
        }
    },

    moveSpeed: function(creep){
        //if PC, movespeed = 0.1 aka above max
        if(creep.level){
            return 0.001
        }
        let bodySize = 0;
        if(creep.memory.tug && creep.memory.pullee){
            bodySize = Game.getObjectById(creep.memory.pullee).body.length;
        }
        const moves = creep.getActiveBodyparts(MOVE);
        bodySize += creep.body.length;
        const carries = _.filter(creep.body, part => part == CARRY).length;//can't use getActive bc inactive carry parts need to be weightless
        const usedCarries = Math.ceil(creep.store.getUsedCapacity() / CARRY_CAPACITY);//used carries have weight
        const fatigues = bodySize - moves - carries + usedCarries;
        return Math.max(fatigues, 0.001)/Math.max(moves, 0.001)
    },

    findNoviceWallSpots: function(pos, direction, roomName){
        const wallSpots = [];
        let loopStart = 0;
        let loopEnd = 25;
        let loopVar = "x";
        let constVar = "y";
        switch(direction){
        case TOP:
            loopStart = 25;
            loopEnd = 50;
            loopVar = "y";
            constVar = "x";
            break
        case BOTTOM:
            loopStart = 0;
            loopEnd = 25;
            loopVar = "y";
            constVar = "x";
            break
        case RIGHT:
            loopStart = 0;
            loopEnd = 25;
            loopVar = "x";
            constVar = "y";
            break
        case LEFT:
            loopStart = 25;
            loopEnd = 50;
            loopVar = "x";
            constVar = "y";
            break
        }

        for(let i = loopStart; i < loopEnd; i++){
            const newPos = {};
            newPos[loopVar] = i;
            newPos[constVar] = pos[constVar];
            wallSpots.push(new RoomPosition(newPos.x, newPos.y, roomName));
        }
        return wallSpots
        //find wall spots in room adjacent to this spot
        // |---------------|    |---------------|
        // | (current room)|    |(x=wallSpot)   |
        // |               |    |               |
        // |               x    xxxxxxxxx       |
        // |               |    |               |
        // |               |    |               |
        // |_______________|    |_______________|
    },

    findNoviceWallRooms: function(room){
        //return value will be an object, with lists as values for keys
        //check if current room even has novice walls
        const walls = _.filter(room.find(FIND_STRUCTURES), s => s.structureType == STRUCTURE_WALL && utils.isOnEdge(s.pos));
        if(!walls.length){
            return {}
        }
        const noviceWallRooms = {};
        const exits = Game.map.describeExits(room.name);
        for(let i = 0; i < Object.keys(exits).length; i++){
            const exitRoomName = exits[Object.keys(exits)[i]];
            noviceWallRooms[exitRoomName] = [];//establish keys as neighboring room names

            //find exit points to each room, and scan for walls on the exit
            const exitName = Game.map.findExit(room.name, exitRoomName);
            const exitPositions = room.find(exitName);//list of roomPos on that exit
            let found = 0;
            for(let j = 0; j < exitPositions.length; j++){
                for(let k = 0; k < walls.length; k++){
                    if(exitPositions[j].isEqualTo(walls[k].pos)){
                        //find necessary wallSpots
                        noviceWallRooms[exitRoomName] = (m$1.findNoviceWallSpots(exitPositions[j], Object.keys(exits)[i], exitRoomName));
                        found++;
                        break
                    }
                }
                if(found > 1){
                    break//no need to loop more than needed, a room won't have more than 2 wall lines
                }
            }
        }
        return noviceWallRooms
    },

    getPath: function(creep, goals, avoidEnemies, maxRooms, boundingBox){
        const moveSpeed = m$1.moveSpeed(creep);//moveSpeed is inverse of fatigue ratio
        const noviceWallRooms = m$1.findNoviceWallRooms(creep.room);
        //if room is highway with novice walls, make an object with each of the neighboring rooms as keys
        //values should be arrays of locations for walls in those rooms
        const roomDataCache = utils.getsetd(Cache, "roomData", {});
        const result = PathFinder.search(creep.pos, goals, {
            plainCost: Math.ceil(moveSpeed),
            swampCost: Math.ceil(moveSpeed * 5),
            maxRooms: maxRooms,
            maxOps: 10000,
            roomCallback: function(roomName){
                const roomData = utils.getsetd(roomDataCache, roomName, {});
                if(roomName != creep.pos.roomName && roomData.owner && !settings_1.allies.includes(roomData.owner) 
                    && goals.pos && goals.pos.roomName != roomName
                    && roomData.rcl 
                    && CONTROLLER_STRUCTURES[STRUCTURE_TOWER][roomData.rcl] 
                    && (!creep.memory.tolerance 
                    || creep.memory.tolerance < CONTROLLER_STRUCTURES[STRUCTURE_TOWER][roomData.rcl] * TOWER_POWER_ATTACK - (TOWER_POWER_ATTACK * TOWER_FALLOFF))){
                    return false
                }
                if(roomData.skLairs && roomData.rcl) return false
                if(Game.map.getRoomStatus(roomName).status != "normal"){
                    return false
                }
                const costs = new PathFinder.CostMatrix;
                if(roomData.skLairs && roomData.skLairs.length){
                    if(!Memory.remotes[roomName] && avoidEnemies && creep.memory.role != "scout") return
                    const terrain = Game.map.getRoomTerrain(roomName);
                    for(const lair of roomData.skLairs){
                        const minX = Math.max(lair.x - 5, 0);
                        const maxX = Math.min(lair.x + 5, 49);
                        const minY = Math.max(lair.y - 5, 0);
                        const maxY = Math.min(lair.y + 5, 49);
                        for(let i = minX; i < maxX; i++){
                            for (let j = minY; j < maxY; j++){
                                if(!(terrain.get(i,j) & TERRAIN_MASK_WALL)){
                                    costs.set(i, j, Math.ceil(50/Math.min(Math.abs(i - lair.x), Math.abs(j - lair.y))));
                                }
                            }
                        }
                    }
                }
                const room = Game.rooms[roomName];
                if(!room){
                    if(noviceWallRooms[roomName] && noviceWallRooms[roomName].length){
                        for(let i = 0; i < noviceWallRooms[roomName].length; i++){
                            costs.set(noviceWallRooms[roomName][i].x, noviceWallRooms[roomName][i].y, 0xff);
                        }
                        return costs
                    }
                    //if room is not visible AND is on the novice highway list, set wall spots accordingly
                    return
                }

                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD || (struct.structureType == STRUCTURE_PORTAL && struct.pos.isEqualTo(goals))) {
                        // Favor roads over plain tiles
                        if(costs.get(struct.pos.x, struct.pos.y) != 0xff){
                            costs.set(struct.pos.x, struct.pos.y, Math.ceil(moveSpeed/2));
                        }
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !(struct.my || (settings_1.allies.includes(struct.owner.username) && struct.isPublic)))) {
                    // Can't walk through non-walkable buildings
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(struct) {
                    if(struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART && struct.structureType != STRUCTURE_CONTAINER){
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                // Avoid creeps in the room
                room.find(FIND_CREEPS).forEach(function(c) {
                    const ccache = utils.getCreepCache(c.id);
                    if(!ccache.lastMove || ccache.lastMove < (Game.time - 1)){
                        if(!creep.my || creep.memory.moveStatus == "static"){
                            costs.set(c.pos.x, c.pos.y, 0xff);
                        } else {
                            costs.set(c.pos.x, c.pos.y, 30);
                        }
                    }
                    if(c.pos.isEqualTo(goals)){
                        costs.set(c.pos.x, c.pos.y, 1);
                    }
                });
                room.find(FIND_POWER_CREEPS).forEach(function(c) {
                    c.my ? costs.set(c.pos.x, c.pos.y, 30): costs.set(c.pos.x, c.pos.y, 0xff);
                });
                if (boundingBox) {
                    m$1.enforceBoundingBox(costs, boundingBox);
                }
                const goalList = goals.length ? goals : [goals];
                for(const goal of goalList){
                    if(goal.pos.roomName != roomName)
                        continue
                    const terrain = Game.map.getRoomTerrain(roomName);
                    const range = goal.range;
                    const minX = Math.max(goal.pos.x - range, 0);
                    const maxX = Math.min(goal.pos.x + range, 49);
                    const minY = Math.max(goal.pos.y - range, 0);
                    const maxY = Math.min(goal.pos.y + range, 49);
                    for(let i = minX; i <= maxX; i++){
                        if(costs.get(i,minY) < 30 && !(terrain.get(i,minY) & TERRAIN_MASK_WALL))
                            costs.set(i,minY, 1);
                        if(costs.get(i,maxY) < 30 && !(terrain.get(i,maxY) & TERRAIN_MASK_WALL))
                            costs.set(i,maxY, 1);
                    }
                    for(let i = minY; i <= maxY; i++){
                        if(costs.get(minX,i) < 30 && !(terrain.get(minX,i) & TERRAIN_MASK_WALL))
                            costs.set(minX,i, 1);
                        if(costs.get(maxX, i) < 30 && !(terrain.get(maxX, i) & TERRAIN_MASK_WALL))
                            costs.set(maxX, i, 1);
                    }
                }
                return costs
            }
        });
        return result
    },

    enforceBoundingBox: function(costs, boundingBox) {
        const d = boundingBox.thickness; // thickness of barrier
        for (let y = boundingBox.top - d; y <= boundingBox.bottom + d; y++) {
            for (let x = boundingBox.left - d; x <= boundingBox.right + d; x++) {
                const inBox = boundingBox.top <= y && y <= boundingBox.bottom
                    && boundingBox.left <= x && x <= boundingBox.right;
                if (!inBox) {
                    costs.set(x, y, 30);
                }
            }
        }
    },

    getRoute: function(start, finish, avoidEnemies){
        const roomDataCache = utils.getsetd(Cache, "roomData", {});
        const route = Game.map.findRoute(start, finish, {
            routeCallback: function(roomName){
                if(utils.isHighway(roomName)){
                    return 1
                }
                if(Game.map.getRoomStatus(roomName).status != "normal") {
                    return Infinity
                }
                const roomData = utils.getsetd(roomDataCache, roomName, {});
                if(roomData.owner && !settings_1.allies.includes(roomData.owner) && roomData.rcl && CONTROLLER_STRUCTURES[STRUCTURE_TOWER][roomData.rcl] && avoidEnemies){
                    return 20
                }
                return settings_1.motion.backRoadPenalty
            }
        });
        return route
    },

    checkRoute: function(creep, endPos){//verify that cached route is up to date
        const ccache = utils.getCreepCache(creep.id);
        //if creep is already in the same room as destination, route does not need to be checked
        if (ccache.route && endPos.roomName == ccache.route[ccache.route.length - 1].room){
            return true
        } else if(endPos.roomName == creep.pos.roomName){
            return true
        } else {
            return false
        }
    },

    checkPath: function(creep, endPos){//verify that cached path is up to date
        const ccache = utils.getCreepCache(creep.id);
        //destination must match destination of cached path
        if(ccache.endPos && endPos.isEqualTo(ccache.endPos)){
            return true
        } else {
            return false
        }
    },

    getBoundingBox: function(room) {
        if (!room.memory.plan) {
            return
        }
        const top = room.memory.plan.y;
        const left = room.memory.plan.x;
        const bottom = top + template.dimensions.y - 1;
        const right = left + template.dimensions.x - 1;
        return new m$1.BoundingBox(top, left, bottom, right)
    }
};

var motion = m$1;

var actions = {
    interact: function(creep, location, fnToTry, range, logSuccess, local=false) {
        var result = fnToTry();
        switch (result) {
        case ERR_NOT_IN_RANGE: {
            const box = local ? motion.getBoundingBox(creep.room) : null;
            return motion.newMove(creep, location.pos, range, true, box)
        }
        case OK:
            if (logSuccess) {
                Log.info(creep.name+ " at " + creep.pos + ": " + fnToTry.toString());
            }
            return 1
        case ERR_BUSY:
        case ERR_FULL:
        case ERR_TIRED:
            return result
        case ERR_NOT_ENOUGH_RESOURCES:
            creep.memory.path = null;
            return result
        default:
            Log.info(creep.memory.role + " at " + creep.pos + ": " + result.toString());
            return result
        }
    },
    
    reserve: function(creep, target){
        var city = creep.memory.city;
        if (Game.time % 2000 == 0){
            return actions.interact(creep, target, () => creep.signController(target, city))
        }
        if(target.room.memory.city != city){
            creep.room.memory.city = city;
        } else {
            return actions.interact(creep, target, () => creep.reserveController(target), 1)
        }
    },

    dismantle: function(creep, target){
        return actions.interact(creep, target, () => creep.dismantle(target), 1)
    },
    
    attack: function(creep, target){
        return actions.interact(creep, target, () => creep.attack(target), 1)
    },

    enablePower: function(creep) {
        return actions.interact(creep, 
            creep.room.controller, 
            () => creep.enableRoom(creep.room.controller), 1)
    },

    usePower: function(creep, target, power) {
        return actions.interact(creep, target, () => creep.usePower(power, target), POWER_INFO[power].range)
    },

    renewPowerCreep: function(creep, target) {
        return actions.interact(creep, target, () => creep.renew(target), 1)
    },
     
    withdraw: function(creep, location, mineral, amount) {
        if (mineral == undefined){
            if (!location || !location.store.getUsedCapacity(RESOURCE_ENERGY)) return ERR_NOT_ENOUGH_RESOURCES
            return actions.interact(creep, location, () => creep.withdraw(location, RESOURCE_ENERGY), 1)
        } else if (amount == undefined){
            return actions.interact(creep, location, () => creep.withdraw(location, mineral), 1)
        } else {
            return actions.interact(creep, location, () => creep.withdraw(location, mineral, amount), 1)
        }
    },

    harvest: function(creep, target) {
        return actions.interact(creep, target, () => creep.harvest(target), 1)
    },

    pick: function(creep, target){
        return actions.interact(creep, target, () => creep.pickup(target), 1)
    },

    upgrade: function(creep) {
        const location = creep.room.controller;
        return actions.interact(creep, location, () => creep.upgradeController(location), 3)
    },
    
    charge: function(creep, location, local=false) {
        const store = creep.store;
        if (Object.keys(store).length > 1){
            const mineral = _.keys(store)[1];
            return actions.interact(creep, location, () => creep.transfer(location, mineral), 1, false, local)
        } else if (Object.keys(store).length > 0) {
            return actions.interact(creep, location, () => creep.transfer(location, Object.keys(store)[0]), 1, false, local)
        }
    },

    // priorities: very damaged structures > construction > mildly damaged structures
    // stores repair id in memory so it will continue repairing till the structure is at max hp
    build: function(creep) {
        if(Game.time % 200 === 0){
            creep.memory.repair = null;
            creep.memory.build = null;
        }
        if (creep.memory.repair){
            var target = Game.getObjectById(creep.memory.repair);
            if(target){
                if (target.hits < target.hitsMax){
                    return actions.repair(creep, target)
                }
            }
        }
        const city = creep.memory.city;
        const myRooms = utils.splitRoomsByCity();
        const buildings = _.flatten(_.map(myRooms[city], room => room.find(FIND_STRUCTURES)));
        const needRepair = _.filter(buildings, structure => (structure.hits < (0.2*structure.hitsMax)) && (structure.structureType != STRUCTURE_WALL) && (structure.structureType != STRUCTURE_RAMPART));
        const walls = _.filter(buildings, structure => (structure.hits < 1000000) && (structure.hits < structure.hitsMax) && (structure.structureType != STRUCTURE_ROAD));
        //Log.info(buildings);
        if(needRepair.length){
            creep.memory.repair = needRepair[0].id;
            return actions.repair(creep, needRepair[0])
            //actions.interact(creep, needRepair[0], () => creep.repair(needRepair[0]));
        } else {
            var targets = _.flatten(_.map(myRooms[city], room => room.find(FIND_MY_CONSTRUCTION_SITES)));
            //var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(targets.length) {
                return actions.interact(creep, targets[0], () => creep.build(targets[0]), 3)
            } else {
                var damagedStructures = _.filter(buildings, structure => (structure.hits < (0.4*structure.hitsMax)) && (structure.structureType != STRUCTURE_WALL) && (structure.structureType != STRUCTURE_RAMPART));
                if (damagedStructures.length) {
                    creep.memory.repair = damagedStructures[0].id;
                    return actions.repair(creep, damagedStructures[0])
                }
                if (walls.length) {
                    const sortedWalls = _.sortBy(walls, structure => structure.hits);
                    creep.memory.repair = sortedWalls[0].id;
                    return actions.repair(creep, sortedWalls[0])
                }
            }
        }
    },

    repair: function(creep, target){
        return actions.interact(creep, target, () => creep.repair(target), 3)
    },
    
    // Pick up stuff lying next to you as you pass by
    notice: function(creep) {
        var tombstones = creep.room.find(FIND_TOMBSTONES);
        var closeStones = _.filter(tombstones, stone => stone.pos.isNearTo(creep.pos));
        if (closeStones.length) {
            //Log.info(closeStones);
            // we can only get one thing per turn, success is assumed since we're close
            const result = creep.withdraw(closeStones[0], _.keys(closeStones[0])[0]);
            switch (result) {
            case ERR_FULL:
                return
            case ERR_NOT_ENOUGH_RESOURCES:
                break
            default:
                //Log.info(result);
                return result
            }
        }
        var resources = creep.room.find(FIND_DROPPED_RESOURCES);
        var closeStuff = _.filter(resources, thing => thing.pos.isNearTo(creep.pos));
        if (closeStuff.length) {
            // we can only get one thing per turn, success is assumed since we're close
            return creep.pickup(closeStuff[0])
        }
    },
    
    getBoosted: function(creep){
        if(creep.spawning){
            return
        }
        const boosts = {"move": "XZHO2", "tough": "XGHO2", "work": "XZH2O", "heal": "XLHO2", "ranged_attack": "XKHO2"};
        for(let i = creep.body.length - 1; i >= 0; i--){
            if(!creep.body[i].boost){
                const type = creep.body[i].type;
                const boost = boosts[type];
                const labs = Object.keys(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers);
                for(const labId of labs){
                    const lab = Game.getObjectById(labId);
                    if(lab.store[boost] >= LAB_BOOST_MINERAL){
                        if(!lab.store.energy){
                            return
                        }
                        //boost self
                        if (lab.boostCreep(creep) === ERR_NOT_IN_RANGE) {
                            motion.newMove(creep, lab.pos, 1);
                        }
                        return
                    }
                }
            }
        }
        creep.memory.boosted = true;
        return
    },

    breakStuff: function(creep) {
        var structures = creep.room.find(FIND_HOSTILE_STRUCTURES);
        var structGroups = _.groupBy(structures, structure => structure.structureType);
        var targetOrder = [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_POWER_SPAWN,
            STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER, STRUCTURE_NUKER, STRUCTURE_STORAGE, 
            STRUCTURE_RAMPART];
 
        for (var i = 0; i < targetOrder.length; i++) {
            var type = targetOrder[i];
            var breakThese = structGroups[type];
            if (breakThese) {
                creep.memory.target = breakThese[0].id;
                return actions.dismantle(creep, breakThese[0]) // TODO break things in your way
            }
        }     
    },
    
    retreat: function(creep) {
        if(Game.time % 20 === 0){
            creep.memory.retreat = false;
        }
        const checkpoints = creep.memory.checkpoints;
        if (checkpoints) {
            const oldCheckpoint = checkpoints[0];
            const o = oldCheckpoint;
            return motion.newMove(creep, new RoomPosition(o.x, o.y, o.roomName), 0)//creep.moveTo(new RoomPosition(o.x, o.y, o.roomName), {reusePath: 0})
        }
    }
};

var actions_1 = actions;

var rL = {

    // range needed to use these
    UPGRADE: 3,
    SOURCE: 1,
    STORAGE: 1,
    LINK: 1,

    fixCacheIfInvalid: function(room) {
        const rN = room.name;
        if (!Cache[rN]) Cache[rN] = {};
        const links = Cache[rN].links || {};
        let storageLink = Game.getObjectById(links.store);
        let upgradeLink = Game.getObjectById(links.upgrade);
        let sourceLinks = _.map(links.source, src => Game.getObjectById(src));
        if(storageLink && Game.time % 10 != 0)
            return
        if (storageLink && upgradeLink && _.reduce(sourceLinks, (l, r) => l && r)
            && sourceLinks.length == 2) {
            return
        } else {
            const memory = Game.spawns[room.memory.city].memory;
            sourceLinks = [];
            for(const source in memory.sources){
                const linkPos = memory.sources[source][STRUCTURE_LINK + "Pos"];
                if(linkPos){
                    const look = room.lookForAt(LOOK_STRUCTURES, Math.floor(linkPos/50), linkPos%50);
                    for(const result of look){
                        if(result.structureType == STRUCTURE_LINK)
                            sourceLinks.push(result);
                    }
                }
            }
            if(memory.upgradeLinkPos){
                const look = room.lookForAt(LOOK_STRUCTURES, Math.floor(memory.upgradeLinkPos/50), memory.upgradeLinkPos%50);
                for(const result of look){
                    if(result.structureType == STRUCTURE_LINK)
                        upgradeLink = result;
                }
            }
            const structures = room.find(FIND_MY_STRUCTURES);
            storageLink = _.find(structures, struct => struct.structureType == STRUCTURE_LINK
                && struct.pos.inRangeTo(room.storage, 2));
            links.store = storageLink ? storageLink.id : null;
            links.upgrade = upgradeLink ? upgradeLink.id : null;
            links.source = _.map(sourceLinks, link => link ? link.id : null);
            Cache[rN].links = links;
        }
    },

    run: function(room) {
        const rcl = room.controller && room.controller.level;
        if (rcl < 5) return

        rL.fixCacheIfInvalid(room);

        const links = Cache[room.name].links;
        const storageLink = Game.getObjectById(links.store);
        const upgradeLink = Game.getObjectById(links.upgrade);
        const sourceLinks = _.map(links.source, src => Game.getObjectById(src));

        // Make transfers
        for (const sourceLink of sourceLinks) {
            if (sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 
                sourceLink.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                continue // sourceLink isn't full yet
            }

            if (rL.readyForLinkTransfer(sourceLink, upgradeLink)) {
                sourceLink.transferEnergy(upgradeLink);
            } else if (rL.readyForLinkTransfer(sourceLink, storageLink)) {
                sourceLink.transferEnergy(storageLink);
            }
        }
        //send from storage link to upgrade link
        if(storageLink && rL.readyForLinkTransfer(storageLink, upgradeLink)){
            storageLink.transferEnergy(upgradeLink);
        }
    },

    getUpgradeLink: function(room) {
        if (room.controller.level < 5) return false
        const spawn = Game.spawns[room.memory.city];
        const linkPos = spawn.memory.upgradeLinkPos;
        if(linkPos){
            const look = room.lookForAt(LOOK_STRUCTURES, Math.floor(linkPos/50), linkPos%50);
            for(const result of look){
                if(result.structureType == STRUCTURE_LINK)
                    return result
            }
        }
        return undefined
    },

    readyForLinkTransfer(sender, receiver) {
        return receiver && !receiver.store.getUsedCapacity(RESOURCE_ENERGY) && !sender.cooldown
    }
};

var link = rL;

var sq = {
    schedule: function(spawn, role, boosted = false, flag = null) {
        sq.initialize(spawn);
        spawn.memory.sq.push({role: role, boosted: boosted, flag: flag});
    },

    peekNextRole: function(spawn) {
        sq.initialize(spawn);
        return spawn.memory.sq[0]
    },

    removeNextRole: function(spawn) {
        sq.initialize(spawn);
        return spawn.memory.sq.shift()
    },

    getCounts: function(spawn) {
        sq.initialize(spawn);
        return _.countBy(spawn.memory.sq, creep => creep.role)
    },

    countByInfo: function(spawn, role, flag = null){
        sq.initialize(spawn);
        return _.filter(spawn.memory.sq, creep => creep.role == role && creep.flag == flag).length
    },

    respawn: function(creep, boosted) {
        const spawn = Game.spawns[creep.memory.city];
        if(!spawn) return
        sq.initialize(spawn);
        sq.schedule(spawn, creep.memory.role, boosted, creep.memory.flag);
    },

    initialize: function(spawn) {
        if (!spawn.memory.sq) {
            spawn.memory.sq = [];
        }
    }

};
var spawnQueue = sq;

var T = {

    chooseTarget: function(towers, hostiles, roomName) {
        if(!towers.length){
            return null
        }
        const healMap = T.generateHealMap(hostiles, roomName);
        for(var i = 0; i < hostiles.length; i++){
            if(hostiles[i].pos.x == 49 || hostiles[i].pos.y == 49 || hostiles[i].pos.x == 0 || hostiles[i].pos.y == 49){
                continue
            }
            let damage = T.calcTowerDamage(towers, hostiles[i]);
            if(Tmp[roomName] && Tmp[roomName].attacks){
                for(const attack of Tmp[roomName].attacks){
                    if(hostiles[i].pos.isEqualTo(attack.x, attack.y)){
                        damage +=  attack.damage;
                    }
                }
            }
            const heal = T.calcHeal(hostiles[i], healMap);
            if(heal > damage){
                continue
            }
            //check creep for boosted tough
            const toughs = T.findToughs(hostiles[i]);
            const buffer = toughs * 333.33;
            if(damage < buffer){
                damage = damage * 0.3;
            } else if(buffer){
                damage = (damage - buffer) + (toughs * 50);
            }
            if(damage > heal + 100){
                return hostiles[i]
            }
        }
        //if we make it here, none of the targets could be out gunned
        //shoot randomly every few ticks, maybe mess something up
        if(Game.time % 12 === 0){
            return hostiles[Math.floor(Math.random() * hostiles.length)]
        }
        return null
    },

    calcTowerDamage: function(towers, target) {
        let damage = 0;
        for(let i = 0; i < towers.length; i++){
            if(towers[i].energy >= TOWER_ENERGY_COST){
                const distance = towers[i].pos.getRangeTo(target.pos);
                const damage_distance = Math.max(TOWER_OPTIMAL_RANGE, Math.min(distance, TOWER_FALLOFF_RANGE));
                const steps = TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE;
                const step_size = TOWER_FALLOFF * TOWER_POWER_ATTACK / steps;
                damage += TOWER_POWER_ATTACK - (damage_distance - TOWER_OPTIMAL_RANGE) * step_size;
            }
        }
        return damage
    }, 

    findToughs: function(creep){
        if(creep.className){//creep is PC
            return 0
        }
        const toughs = creep.getActiveBodyparts(TOUGH);
        if(toughs == 0){
            return 0
        }
        let boosted = false;
        for(var i = 0; i < creep.body.length; i++){
            if(creep.body[i].type === TOUGH){
                if(creep.body[i].boost){
                    boosted = true;
                }
                break
            }
        }
        if(boosted == true){
            return toughs
        } else {
            return 0
        }
    },

    calcHeal: function(creep, healMap){
        return healMap[creep.pos.x][creep.pos.y]
    },  

    generateHealMap: function(hostiles) {
        const map = [];
        for(let i = 0; i < 50; i++){
            map[i] = [];
            for(let j = 0; j < 50; j++){
                map[i][j] = 0;
            }
        }
        for(let i = 0; i < hostiles.length; i++){
            if(hostiles[i].className){//creep is PC
                continue
            }
            //check each hostile for heals, and put them at creep's pos
            const heals = hostiles[i].getActiveBodyparts(HEAL);
            if(heals == 0){
                continue
            }
            let boostMultiplier = 1;
            //if creep has one heal boosted, assume all are T3 boosted
            for(let j = 0; j < hostiles[i].body.length; j++){
                if(hostiles[i].body[j].type === HEAL){
                    if(hostiles[i].body[j].boost){
                        boostMultiplier = BOOSTS[HEAL][hostiles[i].body[j].boost][HEAL];
                    }
                    break
                }
            }
            const heal = heals * HEAL_POWER * boostMultiplier;
            for(var j = hostiles[i].pos.x - 3; j <= hostiles[i].pos.x + 3; j++){
                for(var k = hostiles[i].pos.y - 3; k <= hostiles[i].pos.y + 3; k++){
                    const range = Math.abs(j - hostiles[i].pos.x) <= 1 && Math.abs(k - hostiles[i].pos.y) <= 1 ? 1 : 3;
                    if(j >= 0 && j <= 49 && k >= 0 && k <= 49){
                        map[j][k] += (heal/range);
                    }
                }
            }
        }
        return map
    }
};
var tower = T;

var libb = harasser;

//const sq = require("./spawnQueue"); sq.initialize(Game.spawns['E8N60']); sq.schedule(Game.spawns['E8N60'], 'quad')







var CreepState$2 = {
    START: 1,
    BOOST: 2,
    FORM: 3,
    ENGAGE: 4,
    RALLY: 5,
    DORMANT: 6,
    PRIVATE: 7
};
var CS$2 = CreepState$2;

var rQ = {
    name: "quad",
    type: "quad",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_KEANIUM_ALKALIDE],

    /** @param {Creep} creep **/
    run: function(creep) {
        rQ.init(creep);
        switch(creep.memory.state){
        case CS$2.START:
            //determine whether to get boosted or go form up
            rQ.checkBoost(creep);
            break
        case CS$2.BOOST:
            if(!creep.memory.boosted){
                actions_1.getBoosted(creep);
            } else {
                creep.memory.state = CS$2.FORM;
            }
            //get boosted, then go form up
            break
        case CS$2.FORM:
            //find a captain
            //if no captain, become one
            //captain finds form up location, jimmys sign up for a jimmy slot, then go brain dead
            //captain checks roster and moves jimmys to necessary positions in formation
            rQ.formUp(creep);
            break
        case CS$2.ENGAGE:
            rQ.engage(creep);
            break
        case CS$2.RALLY:
            rQ.rally(creep);
            break
        }
        
    },
    
    init: function(creep){
        if(!creep.memory.state){
            creep.memory.state = CS$2.START;
        }
    },
    
    checkBoost: function(creep){
        if(creep.memory.needBoost){
            creep.memory.state = CS$2.BOOST;
        } else {
            creep.memory.state = CS$2.FORM;
        }
    },

    reform: function(quad, creep){
        const matrix = rQ.getRoomMatrix(creep.pos.roomName);
        let formPoint = null;
        let range = 0;
        while(!formPoint){
            for(let i = Math.max(creep.pos.x - range, 2); i <= Math.min(creep.pos.x + range, 46); i++){
                for(let j = Math.max(creep.pos.y - range, 2); j <= Math.min(creep.pos.y + range, 46); j++)
                    if(matrix.get(i,j) < 255){
                        const look = creep.room.lookForAtArea(LOOK_CREEPS, j, i, j+1, i+1, true);
                        if(!look.length || !_.find(look, c => !c.creep.my)){
                            formPoint = new RoomPosition(i, j,creep.pos.roomName);
                            break
                        }
                    }
                if(formPoint)
                    break
            }
            range++;
        }
        if(!formPoint){
            Log.info("no form point");
            return
        }
        for(let i = 0; i < quad.length; i++){
            const jimmyPos = new RoomPosition(formPoint.x, formPoint.y, formPoint.roomName);
            switch(i){
            case 0:
                break
            case 1:
                jimmyPos.y++;
                break
            case 2:
                jimmyPos.x++;
                jimmyPos.y++;
                break
            case 3:
                jimmyPos.x++;
                break
            }
            new RoomVisual(creep.room.name).text(i,jimmyPos);
            if(!quad[i].pos.isEqualTo(jimmyPos))
                motion.newMove(quad[i], jimmyPos);
        }
        quad[0].memory.reform = Game.time + 5;
    },

    formUp: function(creep){
        //maybe creeps could make sure that their entire squad is spawned until determining a captain and forming up, until then
        //they would renew themselves (has to be done before boosting though)
        
        //form up organization:     C 0
        //(byorder in jimmy list) 1 2
        if(creep.memory.captain){
            //find meeting position
            //choose an exit, and path as close to room center as possible from that exit. 2nd to last pos on path is rally point
            let formPos = null;
            if(creep.memory.rally){
                formPos = new RoomPosition(creep.memory.rally.x, creep.memory.rally.y, creep.memory.rally.roomName);
            } else {
                const matrix = rQ.getRoomMatrix(creep.pos.roomName);
                let startPos = null;
                if(Memory.flags[creep.memory.city + "quadRally"]){
                    const rallyExit = Game.map.findExit(creep.pos.roomName, Memory.flags[creep.memory.city + "quadRally"].roomName);
                    startPos = _.find(creep.room.find(rallyExit), pos => matrix.get(pos.x,pos.y) == 2);
                } else {
                    startPos = _.find(creep.room.find(FIND_EXIT), pos => matrix.get(pos.x,pos.y) == 2);
                }
                const path = PathFinder.search(startPos, {pos: new RoomPosition(25, 25, creep.pos.roomName), range: 1},
                    {maxRooms: 1, roomCallback: function() { return matrix }}).path;
                //TODO: if path is less than 2 in length, find a new startPos and try again

                formPos = path[Math.max(path.length - 2, 0)];
                creep.memory.rally = formPos;
            }
            let inLine = 0;
            if(!creep.pos.isEqualTo(formPos)){
                motion.newMove(creep, formPos);
            } else {
                inLine++;
            }
            for(let i = 0; i < creep.memory.jimmys.length; i++){
                const jimmyPos = new RoomPosition(formPos.x, formPos.y, formPos.roomName);
                switch(i){
                case 0:
                    jimmyPos.x++;
                    break
                case 1:
                    jimmyPos.y++;
                    break
                case 2:
                    jimmyPos.x++;
                    jimmyPos.y++;
                    break
                }
                new RoomVisual(creep.room.name).text(i,jimmyPos);
                const jimmy = Game.getObjectById(creep.memory.jimmys[i]);
                if(!jimmy){
                    continue
                }
                if(!jimmy.pos.isEqualTo(jimmyPos)){
                    motion.newMove(jimmy, jimmyPos);
                } else {
                    inLine++;
                }
                if(inLine == 4){
                    creep.memory.state = CS$2.ENGAGE;
                }
            }
            return
        }
        //find captain
        if(creep.ticksToLive <= 1499){
            const captain = _.find(creep.room.find(FIND_MY_CREEPS), c => c.memory.captain && c.memory.jimmys.length < 3);
            if(captain){//sign up as a jimmy and go brain dead
                captain.memory.jimmys.push(creep.id);
                creep.memory.state = CS$2.PRIVATE;
            } else {//if no captian, become captain
                creep.memory.captain = true;
                creep.memory.jimmys = [];
            }
        }
    },

    update: function(creep){
        //generic info gathering at tick start
        const quad = [creep, Game.getObjectById(creep.memory.jimmys[0]),
            Game.getObjectById(creep.memory.jimmys[1]),
            Game.getObjectById(creep.memory.jimmys[2])];

        if(!rQ.allPresent(quad)){//if quad not fully formed, yolo mode
            rQ.yolo(quad);
            return false
        }

        for(let i = 0; i < quad.length; i++){
            if(!Cache[quad[i].room.name] || !Cache[quad[i].room.name].quadMatrix){//this can be combined with the part where we find enemies
                rQ.getRoomMatrix(quad[i].room.name);
            }
        }
        const everythingByRoom = rQ.splitEverythingByRoom(quad);
        return [quad, everythingByRoom]
    },

    isSafe: function(everythingByRoom, quad/*, destination*/){
        for(let i = 0; i < quad.length; i++){
            if(quad[i].hits < quad[i].hitsMax) return false
        }
        const rooms = Object.keys(everythingByRoom);
        for(let i = 0; i < rooms.length; i++){
            const controller = Game.rooms[rooms[i]].controller;
            if(controller && controller.owner && !settings_1.allies.includes(controller.owner.username)){
                const tower = _.find(everythingByRoom[rooms[i]].structures, struct => struct.structureType == STRUCTURE_TOWER);
                if(tower) return false
            }
            const hostile = _.find(everythingByRoom[rooms[i]].hostiles, h => (utils.getCreepDamage(h, ATTACK) > 0 || utils.getCreepDamage(h, RANGED_ATTACK) > 0) && 
                h.pos.inRangeTo(quad[0], 8) || h.pos.inRangeTo(quad[1], 8) || h.pos.inRangeTo(quad[2], 8) || h.pos.inRangeTo(quad[3], 8));
            if(hostile) return false
        }
        // const exits = Game.map.describeExits(quad[i].pos.roomName)
        // const nextExit = Game.map.findExit(quad[i].pos.roomName, destination)
        // if(exits[nextExit] == destination && )

        return true
    },

    rally: function(creep){
        //move in snake-mode
        const info = rQ.update(creep);
        if(!info) return
        const quad = info[0];
        const everythingByRoom = info[1];
        const flagName = quad[0].memory.city + "quadRally";
        const flag = Memory.flags[flagName];
        const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);

        if(!flag || !rQ.isSafe(everythingByRoom, quad/*, flag.roomName*/) || creep.room.name == flag.roomName){
            creep.memory.safeTime = Game.time + 20;
            creep.memory.state = CS$2.ENGAGE;
            rQ.engage(creep);
            return
        }

        motion.newMove(quad[3], quad[2].pos, 0);
        if(quad[2].pos.inRangeTo(quad[3].pos, 2) || utils.isOnEdge(quad[2].pos))
            motion.newMove(quad[2], quad[1].pos, 0);
        if(quad[1].pos.inRangeTo(quad[2].pos, 2) || utils.isOnEdge(quad[1].pos))
            motion.newMove(quad[1], quad[0].pos, 0);
        if(quad[0].pos.inRangeTo(quad[1].pos, 2) || utils.isOnEdge(quad[0].pos))
            motion.newMove(quad[0], flagPos, 23);
    },
    

    engage: function(creep){
        //TODO: check formation status. If formation is broken up, reform
        //if a member has died, go into YOLO mode
        //captain should preemptively send everybody in YOLO mode if it is at 1 ttl

        const info = rQ.update(creep);
        if(!info) return
        const quad = info[0];
        const everythingByRoom = info[1];
        const flagName = quad[0].memory.city + "quadRally";
        const flag = Memory.flags[flagName];

        if(flag && (!creep.memory.safeTime || creep.memory.safeTime < Game.time) && rQ.isSafe(everythingByRoom, quad) && creep.room.name != flag.roomName){
            creep.memory.state = CS$2.RALLY;
            rQ.rally(creep);
            return
        }

        const status = rQ.getQuadStatus(quad);

        if(!status)
            rQ.reform(quad, creep);

        const target = Game.getObjectById(creep.memory.target);

        rQ.shoot(everythingByRoom, target);

        let needRetreat = rQ.heal(quad, everythingByRoom);//if below certain health thresholds, we might need to retreat
        if(!needRetreat && status){
            needRetreat = rQ.checkDamage(quad, everythingByRoom);
        }

        let retreated = false;
        if(needRetreat && status){
            retreated = rQ.attemptRetreat(quad, everythingByRoom, status);
            //retreat may fail if there is nothing to retreat from
            //although it might be smart to move to a checkpoint if there is nothing to retreat from
        }

        //if we didn't retreat, move to target or rally point
        if(!retreated && status){
            rQ.advance(creep, quad, everythingByRoom, target, status);
        }

        //auto respawn can be requested directly from quad, but overarching manager should actually make it happen

        // if(creep.ticksToLive == creep.body.length * 12 + 200 && Game.flags[creep.memory.city + "quadRally"]){
        //     rQ.spawnQuad(creep.memory.city)
        // } else if(creep.hits < 200 && Game.flags[creep.memory.city + "quadRally"]){
        //     rQ.spawnQuad(creep.memory.city)
        //     creep.suicide()
        // }
    },

    getDamageMatrix: function(roomName){
        if(Cache[roomName].damageMatrix){
            return Cache[roomName].damageMatrix.clone()
        } else {
            return false
        }
    },
    
    getRoomMatrix: function(roomName){
        //always return a copy of the room matrix, in case it needs to be modified
        if(!Cache[roomName]){
            Cache[roomName] = {};
        }
        if(Cache[roomName].quadMatrix && (Game.time % 50 != 0 || !Game.rooms[roomName])){//if there is a matrix already, just copy and return
            return Cache[roomName].quadMatrix.clone()
        } else {//no matrix? make one if we have vision
            if(!Game.rooms[roomName]){
                return false
            }
            const damageMatrix = new PathFinder.CostMatrix;
            const costs = new PathFinder.CostMatrix;
            const terrain = new Room.Terrain(roomName);
            //fill matrix with default terrain values
            for(let i = 0; i < 50; i++){
                for(let j = 0; j < 50; j++){
                    switch(terrain.get(i,j)) {
                    case TERRAIN_MASK_WALL:
                        costs.set(i, j, 255);
                        break
                    case TERRAIN_MASK_SWAMP:
                        costs.set(i, j, 5);
                        break
                    case 0:
                        costs.set(i, j, 1);
                        break
                    }
                }
            }
            
            //if room is visible, fill in structure info
            if(Game.rooms[roomName]){
                Game.rooms[roomName].find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType !== STRUCTURE_CONTAINER && struct.structureType !== STRUCTURE_ROAD &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !struct.my)) {
                        // Can't walk through non-walkable buildings
                        costs.set(struct.pos.x, struct.pos.y, 255);
                    }
                    if(struct.structureType == STRUCTURE_ROAD && costs.get(struct.pos.x, struct.pos.y) != 255){
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    }
                });
                Game.rooms[roomName].find(FIND_MY_CONSTRUCTION_SITES).forEach(function(struct) {
                    if (struct.structureType !== STRUCTURE_CONTAINER && struct.structureType !== STRUCTURE_ROAD &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !struct.my)) {
                        // Can't walk through non-walkable buildings
                        costs.set(struct.pos.x, struct.pos.y, 255);
                    }
                    if(struct.structureType == STRUCTURE_ROAD){
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    }
                });
            }
            
            //loop through everything again, if value of pos is greater than any of the positions TOP, TOP_LEFT or LEFT, then reset those postions to the value of original pos
            for(let i = 0; i < 50; i++){
                for(let j = 0; j < 50; j++){
                    const posCost = costs.get(i,j);
                    if(costs.get(Math.max(0, i - 1), Math.max(0, j - 1)) < posCost){//TOP_LEFT
                        costs.set(Math.max(0, i - 1), Math.max(0, j - 1), posCost);
                    }
                    if(costs.get(i, Math.max(0, j - 1)) < posCost){//TOP
                        costs.set(i, Math.max(0, j - 1), posCost);
                    }
                    if(costs.get(Math.max(0, i - 1), j) < posCost){//LEFT
                        costs.set(Math.max(0, i - 1), j, posCost);
                    }
                    if(utils.isOnEdge(new RoomPosition(i, j, roomName))){
                        costs.set(i, j, posCost + 1);
                    }
                }
            }

            const towers = _.filter(Game.rooms[roomName].find(FIND_HOSTILE_STRUCTURES), s => s.structureType == STRUCTURE_TOWER);
            if(towers && towers.length){
                for(let i = 0; i < 50; i++){
                    for(let j = 0; j < 50; j++){
                        damageMatrix.set(i, j, tower.calcTowerDamage(towers, new RoomPosition(i, j, roomName)));
                    }
                }
            }
            Cache[roomName].damageMatrix = damageMatrix;
            Cache[roomName].quadMatrix = costs;
            return costs.clone()
        }
    },

    yolo: function(quad){//disband quad into harassers
        for(let i = 0; i < quad.length; i++){
            if(quad[i]){
                quad[i].memory.reinforced = true;//keeps quad members from trying to call in a boosted harasser
                quad[i].memory.role = libb.name;
            }
        }
    },

    allPresent: function(quad){//make sure all members are alive and above 1 ttl
        for(let i = 0; i < quad.length; i++){
            if(!quad[i] || quad[i].ticksToLive == 1){
                return false
            }
        }
        return true
    },

    splitEverythingByRoom: function(quad){
        const everythingByRoom = {};
        const creepsByRoom = _.groupBy(quad, c => c.pos.roomName);
        for(let i = 0; i < Object.keys(creepsByRoom).length; i++){
            everythingByRoom[Object.keys(creepsByRoom)[i]] = {};
            everythingByRoom[Object.keys(creepsByRoom)[i]].creeps = creepsByRoom[Object.keys(creepsByRoom)[i]];
        }
        //everyThingByRoom now has keys defined, with creep categories filled

        //now add creeps and structures based on creeps[0] in each room
        const rooms = Object.keys(everythingByRoom);
        for(let i = 0; i < rooms.length; i++){
            everythingByRoom[rooms[i]].hostiles = utils.findHostileCreeps(Game.rooms[rooms[i]]);
            everythingByRoom[rooms[i]].structures = utils.findHostileStructures(Game.rooms[rooms[i]]);

            rQ.updateMatrices(rooms[i]);//update matrices while we're at it
        }
        return everythingByRoom
    },

    updateMatrices: function(roomName){
        if(!Cache[roomName] || !Cache[roomName].quadMatrix){//update matrices while we're at it
            rQ.getRoomMatrix(roomName);
        }
    },

    findClosestByPath: function(everythingByRoom){
        const targets = [];
        Object.keys(everythingByRoom).forEach(function (roomName) {
            if(everythingByRoom[roomName].hostiles){
                const hostiles = _.filter(everythingByRoom[roomName].hostiles, h => !utils.isOnEdge(h.pos)).concat(everythingByRoom[roomName].structures);
                targets.push(everythingByRoom[roomName].creeps[0].pos.findClosestByPath(hostiles));
            }
        });
        if(!targets.length){
            return null
        } else if(targets.length == 1){
            return targets[0]
        } else {
            return targets[0]
        }
    },

    getDamageTolerance: function(quad){
        if(!quad[0].memory.tolerance){
            const heals = quad[0].getActiveBodyparts(HEAL);
            const boostedPart = _.find(quad[0].body, part => part.type == HEAL && part.boost);
            const multiplier = boostedPart ? BOOSTS[HEAL][boostedPart.boost][HEAL] : 1;
            quad[0].memory.tolerance = HEAL_POWER * multiplier * heals * 4;
        }
        return quad[0].memory.tolerance
    },

    checkDamage: function(quad, everythingByRoom){//bool
        //return true if there is a melee creep adjacent to any of the quad members
        let damage = rQ.getTowerDamage(quad);
        const tolerance = rQ.getDamageTolerance(quad);
        for(const roomName of Object.values(everythingByRoom)){
            const melee = _.filter(roomName.hostiles, c => !c.level && c.getActiveBodyparts(ATTACK));
            const ranged = _.filter(roomName.hostiles, c => !c.level &&c.getActiveBodyparts(RANGED_ATTACK));
            for(const member of roomName.creeps){
                for(const attacker of melee){
                    if(member.pos.isNearTo(attacker.pos) ||(member.pos.inRangeTo(attacker.pos, 2) && !attacker.fatigue)){
                        damage += utils.getCreepDamage(attacker, ATTACK);
                    }
                }
                for(const ranger of ranged){
                    if(member.pos.inRangeTo(ranger.pos, 3) ||(member.pos.inRangeTo(ranger.pos, 4) && !ranger.fatigue)){
                        damage += utils.getCreepDamage(ranger, RANGED_ATTACK);
                    }
                }
            }
        }
        if(damage > tolerance + 100){
            return true
        }
        return false
    },

    advance: function(creep, quad, everythingByRoom, target, status){
        //if no target, find a target.
        //  a target shouldn't simply be "anything that breathes".
        //  if we aren't in the destination room, a target must be impeding motion to the target room to be considered
        //  if we are in the target room, there should be a certain prioritization to killing essential structures
        //if no viable target found, move to rally flag
        const flagName = quad[0].memory.city + "quadRally";
        const flag = Memory.flags[flagName];
        if(target && utils.isOnEdge(target.pos)){
            target = null;
        }
        if(!target){
            if(!flag || Object.keys(everythingByRoom).includes(flag.roomName)){
                const lookRoom = flag && flag.roomName || creep.pos.roomName;
                const everythingInRoom = everythingByRoom[lookRoom];
                //we are at destination
                target = rQ.chooseNextTarget(everythingInRoom);
            }
        }
        
        // TODO: Check for creeps in area and react to them. [#153]

        if(!target && creep.memory.targetPos && creep.pos.roomName == creep.memory.targetPos.roomName){
            creep.memory.targetPos = null;
        }
        if((target && target.pos) || creep.memory.targetPos){
            const pos = (target && target.pos) || new RoomPosition(creep.memory.targetPos.x, creep.memory.targetPos.y, creep.memory.targetPos.roomName);
            if(target){
                creep.memory.targetPos = target.pos;
                creep.memory.target = target.id;
            }
            rQ.move(quad, pos, status, 1);
        } else if(flag && !creep.pos.inRangeTo(new RoomPosition(flag.x, flag.y, flag.roomName), 8)) {
            rQ.move(quad, new RoomPosition(flag.x, flag.y, flag.roomName), status, 5);
        }
    },

    // Valuable buildings: everything except walls, ramparts, roads
    // 1. If there are valuable buildings then we need to destroy them
    // 2. Get the target based on the valuable buildings.
    chooseNextTarget: function(everythingInRoom) {
        const valuableStructures = rQ.getValuableStructures(everythingInRoom.structures);
        const creep = everythingInRoom.creeps[0];
        if (valuableStructures.length) {
            return rQ.getTarget(creep, valuableStructures, everythingInRoom.structures)
        }
        if(everythingInRoom.hostiles.length){
            return rQ.getTarget(creep, everythingInRoom.hostiles, everythingInRoom.structures)
        }
        if(everythingInRoom.structures.length){
            return everythingInRoom.structures[0]
        }
        return false
    },

    getValuableStructures: function(structures) {
        const ignoreStructures = [STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_ROAD,
            STRUCTURE_CONTAINER];
        return _(structures)
            .filter(structure => !ignoreStructures.includes(structure.structureType))
            .value()
    },

    // Find an attack vector to a building based on the lowest hits required
    getTarget: function(creep, valuableStructures, structures) {
        const result = PathFinder.search(creep.pos, _.map(valuableStructures, function(e) {
            return { pos: e.pos, range: 0 }}), {
            plainCost: 1,
            swampCost: 1,
            maxOps: 10000,
            roomCallback: (roomName) => {
                const room = Game.rooms[roomName];
                if (!room || roomName != creep.room.name) return false

                // 2 times largest building since quad is 2 wide
                const maxHits = 2 * _(structures).max("hits").hits;
                const costs = new PathFinder.CostMatrix;

                // count structure 4 times since quad will hit it in 4 positions
                // the path is relative to the top left creep, __ so a structure in the
                // bottom right needs to be counted against a  _S path through the top left
                for (const structure of structures) {
                    for (const pos of [[0, 0], [0, -1], [-1, 0], [-1, -1]]) {
                        const x = structure.pos.x + pos[0];
                        const y = structure.pos.y + pos[1];
                        const oldCost = costs.get(x, y);
                        const cost = rQ.getCost(structure.hits, maxHits, oldCost);
                        costs.set(x, y, cost);
                    }
                }

                const terrain = new Room.Terrain(roomName);
                for(let i = 0; i < 50; i++){
                    for(let j = 0; j < 50; j++){
                        const tile = terrain.get(i, j);
                        const weight = tile & TERRAIN_MASK_WALL  ? 255 : 1;
                        costs.set(i, j, Math.max(costs.get(i,j), weight));//high hp should never be overridden by terrain
                        costs.set(Math.max(i - 1, 0), j, Math.max(costs.get(Math.max(i - 1, 0),j), weight));
                        costs.set(Math.max(i - 1, 0), Math.max(j - 1, 0), Math.max(costs.get(Math.max(i - 1, 0), Math.max(j - 1, 0)), weight));
                        costs.set(i, Math.max(j - 1, 0), Math.max(costs.get(i, Math.max(j - 1, 0)), weight));
                    }
                }
                for(const struct of valuableStructures){//destinations reset to walkable in case they got labelled as a terrain wall
                    const obstacles = struct.pos.lookFor(LOOK_STRUCTURES);
                    let totalHits = 0;
                    for(const obstacle of obstacles){
                        totalHits += obstacle.hits;
                    }
                    costs.set(struct.pos.x, struct.pos.y, rQ.getCost(totalHits, maxHits, 1));
                }
                return costs
            }
        });
        if (result.incomplete || !result.path.length) return false
        
        const path = result.path;
        
        const wallInPath = rQ.getWallInQuadPath(creep.room, path);
        if (wallInPath) {
            return wallInPath
        }

        // if nothing is in our path then return the target at the end of the path
        const targetPos = path.pop();
        const targets = targetPos.lookFor(LOOK_CREEPS).concat(targetPos.lookFor(LOOK_STRUCTURES));
        const target = _(targets).min("hits");
        return target
    },

    // Find the first wall in our path and select it
    getWallInQuadPath: function(room, path) {
        const blockingStructures = [STRUCTURE_WALL, STRUCTURE_RAMPART];
        return _(path)
            .map(pos => rQ.getOverlappingStructures(room, pos))
            .flatten()
            .find(structure => blockingStructures.includes(structure.structureType))
    },

    getOverlappingStructures: function(room, pos) {
        const quadPoses = [[0, 0], [0, 1], [1, 0], [1, 1]];
        return _(quadPoses)
            .map(quadPos => room.lookForAt(LOOK_STRUCTURES, 
                Math.min(pos.x + quadPos[0], 49), 
                Math.min(pos.y + quadPos[1], 49)))
            .flatten()
            .value()
    },

    // get a score between 1 and 254. 255 is "blocked" & 0 is "free" so we don't want these
    getCost: function(hits, maxHits, oldCost) {
        const ratio = Math.round(255 * hits / maxHits);
        return Math.max(1, Math.min(oldCost + ratio, 254)) // 0 < ratio < 255
    },

    getTowerDamage: function(quad){
        const matrix = rQ.getDamageMatrix(quad[0].room.name);
        if(matrix){
            return Math.max(Math.max(matrix.get(quad[0].pos.x,quad[0].pos.y),matrix.get(quad[1].pos.x,quad[1].pos.y)),
                Math.max(matrix.get(quad[2].pos.x,quad[2].pos.y),matrix.get(quad[3].pos.x,quad[3].pos.y)))
        }
        return 0
    },

    attemptRetreat: function(quad, everythingByRoom, status){//bool
        //retreat may fail if there is nothing to retreat from
        //although it might be smart to move to a checkpoint if there is nothing to retreat from
        let allHostiles = [];
        for(let i = 0; i < Object.keys(everythingByRoom).length; i++){
            allHostiles = allHostiles.concat(Object.values(everythingByRoom)[i].hostiles);
        }
        const dangerous = _.filter(allHostiles, c => !c.level && (c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK)));
        let goals = _.map(dangerous, function(c) {
            return { pos: c.pos, range: 5 }
        });
        let allTowers = [];
        for(const everythingInRoom of Object.values(everythingByRoom)){
            allTowers = allTowers.concat(_.filter(everythingInRoom.structures, s => s.structureType == STRUCTURE_TOWER));
        }
        goals = goals.concat(_.map(allTowers, function(t) { return { pos: t.pos, range: 20 } }));
        rQ.move(quad, goals, status, 0, true);
        return true
    },

    shoot: function(everythingByRoom, target){
        //prioritize creeps if the target is a structure
        //ignore creeps that are under a ramp
        //and don't forget to RMA when at melee
        //maybe even RMA if total damage dealt will be greater than RA?
        for(const roomName of Object.values(everythingByRoom)){
            const hostiles = _.filter(roomName.hostiles, hostile => !rQ.isUnderRampart(hostile));
            for(const creep of roomName.creeps){
                if(_.find(hostiles, h => h.pos.isNearTo(creep.pos)) 
                    || _.find(roomName.structures, s => s.owner && s.hits && s.pos.isNearTo(creep.pos))){
                    creep.rangedMassAttack();
                    utils.logDamage(creep, creep.pos, true);
                    continue
                }
                const targetInRange = target && target.pos.inRangeTo(creep.pos, 3);
                if(targetInRange && !target.structureType && !rQ.isUnderRampart(target)){
                    creep.rangedAttack(target);
                    utils.logDamage(creep, target.pos);
                    continue
                }
                const newTarget = _.find(hostiles, h => h.pos.inRangeTo(creep.pos, 3));
                if(newTarget){
                    creep.rangedAttack(newTarget);
                    utils.logDamage(creep, newTarget.pos);
                    continue
                }
                if(targetInRange && target.structureType){
                    creep.rangedAttack(target);
                    utils.logDamage(creep, target.pos);
                    continue
                }
                const structureTarget = _.find(roomName.structures, h => h.pos.inRangeTo(creep.pos, 3));
                if(structureTarget){
                    creep.rangedAttack(structureTarget);
                    utils.logDamage(creep, structureTarget.pos);
                }
            }
        }
    },

    isUnderRampart: function(creep){
        const structures = creep.pos.lookFor(LOOK_STRUCTURES);
        if(structures.length) {
            for(let i = 0; i < structures.length; i++){
                if(structures[i].structureType == STRUCTURE_RAMPART){
                    return true
                }
            }
        }
        return false
    },

    heal: function(quad, everythingByRoom){//bool, TODO: preheal based on positioning/intelligence
        //return true if a retreat is needed
        let hostiles = [];
        for(const roomName of Object.values(everythingByRoom)){
            hostiles = hostiles.concat(roomName.hostiles);
        }
        const damaged = _.min(quad, "hits");
        if(damaged.hits < damaged.hitsMax * 0.9){
            for(let i = 0; i < quad.length; i++){
                quad[i].heal(damaged);
            }
        } else if(hostiles.length || damaged.hits < damaged.hitsMax){
            for(let i = 0; i < quad.length; i++){
                quad[i].heal(quad[i]);
            }
        }
        if(damaged.hits < damaged.hitsMax * 0.85){
            return true
        }
        return false
    },

    moveByPath: function(leader, quad, path, status){
        for(let i = 0; i < quad.length; i++){
            if(quad[i].fatigue || !quad[i].getActiveBodyparts(MOVE)){
                return
            }
        }
        let direction = null;
        if(leader.pos.isNearTo(path[0])){
            direction = leader.pos.getDirectionTo(path[0]);
        } else {
            for(let i = 0; i < path.length; i++){
                if(leader.pos.isEqualTo(path[i]) && i < path.length - 1){
                    direction = path[i].getDirectionTo(path[i + 1]);
                    break
                }
            }
        }
        if(direction){
            if(status.roomEdge && Math.abs(direction - status.roomEdge) == 4){
                return //if quad wants to move against the grain on exit, stay still
            }
            for(let i = 0; i < quad.length; i++){
                quad[i].move(direction);
            }
        } else if(!status.roomEdge && (Game.cpu.bucket > 9000 || _.find(quad, c => c.hits < c.hitsMax))){//if not moving do an idle dance?
            const nextLocation = Math.floor(Math.random() * 3) + 1;//1, 2, or 3
            for(let i = 0; i < quad.length; i++){
                let nextCreep = i + nextLocation;
                if(nextCreep >= quad.length){
                    nextCreep -= quad.length;
                }
                direction = quad[i].pos.getDirectionTo(quad[nextCreep]);
                quad[i].move(direction);
            }
        }
    },

    longRangeToLocal: function(quad, leader, target){
        const route = Game.map.findRoute(leader.pos.roomName, target.roomName, {
            routeCallback(roomName) {
                let returnValue = 2;
                if(Game.map.getRoomStatus(roomName).status != "normal") {
                    returnValue = Infinity;
                } else {
                    const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    const isHighway = (parsed[1] % 10 === 0) || 
                                    (parsed[2] % 10 === 0);
                    const isMyRoom = Game.rooms[roomName] &&
                        Game.rooms[roomName].controller &&
                        Game.rooms[roomName].controller.my;
                    if (isHighway || isMyRoom) {
                        returnValue = 1;
                    } else if(Cache[roomName] && Cache[roomName].enemy){
                        returnValue = 20;
                    } else {
                        returnValue = 2;
                    }
                }
                if(rQ.getRoomMatrix(roomName)){
                    returnValue = returnValue * 0.8;
                }
                return returnValue
            }
        });
        if(!route.length){
            return null
        }
        for(let i = 0; i < route.length; i++){
            if(!rQ.getRoomMatrix(route[i].room)){
                const start = route[i-1] && route[i-1].room || leader.pos.roomName;
                const exits = utils.findExitPos(start, route[i].exit);
                const goals = _.map(exits, function(exit) {
                    return { pos: exit, range: 0 }
                });
                return goals
            }
        }

        //if we don't have a creep in the required room, we need to move to route[0]
        for(let i = 0; i < quad.length; i++){
            if(quad[i].pos.roomName == target.roomName){//we are already in required room
                return null
            }
        }
    },

    move: function(quad, target, status, range, retreat = false){
        if(!range){
            range = 0;
        }
        let destination = null;
        if(!retreat){
            const newTarget = rQ.longRangeToLocal(quad, status.leader, target);
            if(newTarget){
                destination = newTarget;
            } else {
                destination = {pos: target, range: range};
            }
        } else {
            destination = target;
        }
        if(range == 1){
            range = 2;
            if(status.leader.pos.inRangeTo(target, 2)
            && _.every(quad, member => !member.pos.isNearTo(target))){
                range = 1;
            }
        }
        const matrix = {};

        const search = PathFinder.search(status.leader.pos, destination, {
            maxRooms: 4,
            flee: retreat,
            roomCallback: function(roomName){
                const costs = rQ.getRoomMatrix(roomName);
                if(!costs){
                    return false
                }
                const damageMatrix = rQ.getDamageMatrix(roomName);
                if(status.roomEdge){
                    //if formation is on a roomEdge, and any of members is in a room but not on it's edge, we cannot move into that room
                    //unless they are all in that room
                    for(let i = 0; i < quad.length; i++){//save a little cpu by not using a room we can't move into anyway
                        if(!status.sameRoom && status.leader.pos.roomName != roomName && quad[i].pos.roomName == roomName && !utils.isOnEdge(quad[i].pos)){
                            return false
                        }
                    }
                    //otherwise, if this is leader's room, block necessary positions to limit motion in appropriate fashion
                    //see: getQuadStatus()
                    const leader = status.leader;
                    for(let i = -1; i < 2; i++){
                        for(let j = -1; j < 2; j++){
                            if(leader.pos.x + i > 0 && leader.pos.x + i < 50 && leader.pos.y + j > 0 && leader.pos.y + j < 50){
                                const direction = leader.pos.getDirectionTo(new RoomPosition(leader.pos.x + i, leader.pos.y + j, roomName));
                                const tolerance = 1;
                                if(Math.abs(direction - status.roomEdge) != 4 && Math.abs(direction - status.roomEdge) > tolerance && (Math.abs(direction - status.roomEdge) != 7)){
                                    //because TOP == 1 and TOP_LEFT == 8, a difference of 7 actually signals adjacency
                                    //unwalkable
                                    costs.set(leader.pos.x + i, leader.pos.y + j, 255);
                                }
                            }
                        }
                    }
                }
                if(Game.rooms[roomName]){
                    //if we have vision, add creeps to matrix, otherwise just return it plain
                    const quadNames = [];
                    for(let i = 0; i < quad.length; i++){
                        quadNames.push(quad[i].id);
                    }
                    for (const creep of Game.rooms[roomName].find(FIND_CREEPS)) {
                        if(!_(quad).find(member => member.pos.inRangeTo(creep.pos, 8))
                            || (!settings_1.allies.includes(creep.owner.username) && !_(quad).find(member => member.pos.inRangeTo(creep.pos, 3)))){
                            continue
                        }
                        if(!quadNames.includes(creep.id)){
                            //quad cannot move to any pos that another creep is capable of moving to
                            const attackThreat = utils.getCreepDamage(creep, ATTACK) > rQ.getDamageTolerance(quad);
                            const offset = attackThreat && !creep.fatigue ? 3 :
                                attackThreat ? 2 : 1;
                            for(let i = Math.max(0 , creep.pos.x - offset); i < Math.min(50, creep.pos.x + offset); i++){
                                for(let j = Math.max(0 , creep.pos.y - offset); j < Math.min(50, creep.pos.y + offset); j++){
                                    costs.set(i, j, 255);
                                }
                            }
                        }
                    }
                }

                //factor in tower damage
                //TODO: include creep damage as well
                if(damageMatrix){
                    const healPower = status.leader.getActiveBodyparts(HEAL) * 48;
                    for(let i = 0; i < 50; i++){
                        for(let j = 0; j < 50; j++){
                            const damage = damageMatrix.get(i, j);
                            if(damage > healPower){
                                costs.set(i, j, costs.get(i, j) + damage - healPower);
                            }
                        }
                    }
                }
                matrix[roomName] = costs;
                //if retreating, block off exits
                if(retreat){
                    for(let i = 0; i < 50; i++){
                        costs.set(i, 0, 255);
                        costs.set(i, 48, 255);
                        costs.set(0, i, 255);
                        costs.set(48, i, 255);
                    }
                }
                return costs
            }
        });
        if(search.incomplete);
        rQ.moveByPath(status.leader, quad, search.path, status);
    },

    getQuadStatus: function(quad){//return squad leader, roomEdge status, and if creeps are all in the same room
        //we need to know which creep is in which position because all pathfinding must be done based on the creep in the top left
        //roomEdge status determines which directions we can move
        //For Example: if roomEdge status == RIGHT && creeps are not all in the same room, we can only move RIGHT,
        //however, if creeps are all in the same room, we can move RIGHT, TOP_RIGHT, or BOTTOM_RIGHT
        //halting on a roomEdge will always result in the edge flipping the following tick i.e. if roomEdge == RIGHT, next tick it'll be LEFT
        let leader = null;
        let highRoom = []; //creeps that are in the leftmost or topmost room of creeps in squad
        for(let i = 0; i < quad.length; i++){//if a creep's room is higher than any other squad member's room, it must be in the highest room
            const coords = utils.roomNameToPos(quad[i].pos.roomName);
            for(let j = 0; j < quad.length; j++){
                const compCoords = utils.roomNameToPos(quad[j].pos.roomName);
                if(coords[0] < compCoords[0] || coords[1] > compCoords[1]){
                    highRoom.push(quad[i]);
                    break
                }
            }
        }
        //if highRoom is empty, all creeps are in highRoom
        if(!highRoom.length){
            highRoom = quad;
        }
        //amongst creeps in highroom, find toppest leftest one
        for(let i = 0; i < highRoom.length; i++){
            let topLeft = true;
            for(let j = 0; j < highRoom.length; j++){//if creep is not top, left, or top left of every other creep, it is not the leader
                if(highRoom[j].pos.getDirectionTo(highRoom[i]) != LEFT 
                    && highRoom[j].pos.getDirectionTo(highRoom[i]) != TOP_LEFT 
                    && highRoom[j].pos.getDirectionTo(highRoom[i]) != TOP
                    && !highRoom[j].pos.isEqualTo(highRoom[i])){
                    topLeft = false;
                }
            }
            if(topLeft){
                leader = highRoom[i];
                break
            }
        }

        //determine roomEdge status
        let roomEdge = null; //default is null, if we are not on an edge it should stay that way
        for(let i = 0; i < quad.length; i++){
            if(utils.isOnEdge(quad[i].pos)){//if a creep from the squad is on an edge, it can determine which edge we are on
                if(quad[i].pos.x == 49){
                    roomEdge = LEFT;
                } else if(quad[i].pos.x == 0){
                    roomEdge = RIGHT;
                } else if (quad[i].pos.y == 49){
                    roomEdge = TOP;
                } else {
                    roomEdge = BOTTOM;
                }
                break
            }
        }
        if(!leader)
            return null
        if(!roomEdge)
            for(let i = 0; i < quad.length; i++)
                for(let j = i;j < quad.length; j++)
                    if(!quad[i].pos.isNearTo(quad[j].pos))
                        return null
        if(roomEdge && quad[0].memory.reform && quad[0].memory.reform > Game.time){
            return null
        }

        const result = {};

        result.leader = leader;
        result.roomEdge = roomEdge;
        //if all of the creeps in the squad are in the highest room, they must all be in the same room
        result.sameRoom = highRoom.length < quad.length ? false : true;
        return result
    }    
};
var quad = rQ;

const m = {

    attack: function() {
        if (m.attackUnderway()) {
            return
        }
        const roomName = m.getNextRoomToAttack();
        if (roomName) {
            m.deployQuad(roomName);
        }
    },

    attackUnderway: function() {
        return _(Object.keys(Memory.flags))
            .find(name => name.includes("quad"))
    },

    getNextRoomToAttack: function() {
        const militaryCache = utils.getsetd(Cache, "military", {});
        const nextTargets = utils.getsetd(militaryCache, "targets", m.findTargets());
        return nextTargets && nextTargets.shift()
    },

    findTargets: function() {
        const roomData = utils.getsetd(Cache, "roomData", {});
        const cities = _(utils.getMyCities()).map("name").value();
        const allNeighbors = _(cities).map(city => utils.getAllRoomsInRange(1, [city])).value();

        return _(cities)
            .zipObject(allNeighbors)
            .map((neighbors, city) => {
                return _(neighbors).filter(neighbor => {
                    const data = roomData[neighbor] || {};
                    const tooFar = () => {
                        const route = Game.map.findRoute(city, neighbor);
                        return route == ERR_NO_PATH || route.length > 1
                    };
                    return data.enemy && data.towers <= 2
                            && data.rcl <= 6 && !tooFar()
                }).value()
            })
            .flatten()
            .value()
    },

    deployQuad: function(roomName, boosted) {
        const flagPos = m.nonWallRoomPos(roomName);

        const closestRoomName = m.chooseClosestRoom(flagPos);
        const flagName = `${closestRoomName}0quadRally`;
        if (flagName in Memory.flags) {
            Log.error(`Quad already deployed from ${closestRoomName}`);
            return
        }

        Memory.flags[flagName] = flagPos;
        m.spawnQuad(`${closestRoomName}0`, boosted);
    },

    nonWallRoomPos: function(roomName) {
        const terrain = Game.map.getRoomTerrain(roomName);
        for(let y = 0; y < 50; y++) {
            for(let x = 0; x < 50; x++) {
                if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
                    return new RoomPosition(x, y, roomName)
                }
            }
        }
    },

    chooseClosestRoom: function(flagPos){
        const cities = utils.getMyCities();
        const goodCities = _.filter(cities, m.canSpawnQuad);
        const lengths = _.map(goodCities, city => {
            const testRoomPos = city.getPositionAt(25, 25);
            const testPath = utils.findMultiRoomPath(testRoomPos, flagPos);
            if (testPath.incomplete || city.name == flagPos.roomName) {
                return Number.MAX_VALUE
            }
            return testPath.cost
        });
        const i = _.indexOf(lengths, _.min(lengths));
        const nearestCity = goodCities[i];

        if(lengths[i] > CREEP_LIFE_TIME) {
            Log.info(`No valid rooms in range for ${quad.name} in ${flagPos.roomName}`);
        }
        return nearestCity.name
    },

    canSpawnQuad: function(city) {
        return city.controller.level == 8 &&
            Game.spawns[city.memory.city] &&
            city.storage
    },

    spawnQuad: function(city, boosted){
        spawnQueue.initialize(Game.spawns[city]);
        for(let i = 0; i < 4; i++){
            spawnQueue.schedule(Game.spawns[city], quad.name, boosted);
        }
    }
};

var military = m;

var rH = {
    name: "harasser",
    type: "harasser",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_KEANIUM_ALKALIDE],

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.needBoost && !creep.memory.boosted){
            actions_1.getBoosted(creep);
            return
        }
        const flagName = creep.memory.flag || creep.memory.city + "harass";
        if(creep.hits < creep.hitsMax * 0.2 && !creep.memory.reinforced){
            creep.memory.reinforced = true;
            spawnQueue.respawn(creep, true);
            if(Memory.flags["claim"] && creep.room.name == Memory.flags["claim"].roomName){
                Memory.flags[creep.memory.city + "quadRally"] = Memory.flags["claim"];
                military.spawnQuad(creep.memory.city, true);
            }
        }
        if(Game.time % 51 == 0){
            //check to remove flag and respawn
            rH.removeFlag(creep, flagName);
            if(Memory.flags[flagName] && !creep.memory.respawnTime){
                const route = motion.getRoute(Memory.flags[flagName].roomName, Game.spawns[creep.memory.city].room.name, true);
                if(route && route.length){
                    creep.memory.respawnTime = (route.length * 50) + (creep.body.length * CREEP_SPAWN_TIME);
                }
            }
        }
        if(creep.memory.respawnTime && creep.ticksToLive == creep.memory.respawnTime && Memory.flags[flagName]){
            const reinforcement = _.find(creep.room.find(FIND_MY_CREEPS), c => c.memory.role == rH.name && c.name != creep.name);
            if(!reinforcement){
                spawnQueue.respawn(creep);
            }
        }
        if(rH.dormant(creep)){
            return
        }
        rH.init(creep);
        const hostiles = _.filter(creep.room.find(FIND_HOSTILE_CREEPS), c => !settings_1.allies.includes(c.owner.username));
        rH.maybeHeal(creep, hostiles);
        if(!hostiles.length){
            if(Memory.flags[flagName] && creep.room.name == Memory.flags[flagName].roomName){
                const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);
                if(hostileStructures.length){
                    if(!Game.getObjectById(creep.memory.target)){
                        creep.memory.target = hostileStructures[0].id;
                    }
                } else {
                    if(rH.rally(creep, flagName)){
                        return
                    }
                }
            } else {
                if(rH.rally(creep, flagName)){
                    return
                }
            }
        }
        creep.memory.dormant = false;
        const needRetreat = rH.maybeRetreat(creep, hostiles);
        if(!needRetreat && (hostiles.length || Game.getObjectById(creep.memory.target))){
            rH.aMove(creep, hostiles);
        }
        rH.shoot(creep, hostiles);
    },

    shoot: function(creep, hostiles){
        //RMA if anybody is touching
        for(var i = 0; i < hostiles.length; i++){
            if(hostiles[i].pos.isNearTo(creep.pos)){
                creep.rangedMassAttack();
                utils.logDamage(creep, creep.pos, true);
                return
            }
        }
        //if target and in range, shoot target, otherwise shoot anybody in range
        if(creep.memory.target){
            const target = Game.getObjectById(creep.memory.target);
            if(target && target.pos.inRangeTo(creep.pos, 3)){
                creep.rangedAttack(target);
                utils.logDamage(creep, target.pos);
                return
            }
        }
        const newTarget = creep.pos.findClosestByRange(hostiles);
        if(newTarget && newTarget.pos.getRangeTo(creep) <= 3){
            creep.rangedAttack(newTarget);
            utils.logDamage(creep, newTarget.pos);
        }
    },

    dormant: function(creep){
        if(creep.memory.dormant){
            if(Game.time % 5 != 0){
                return true
            }
        }
        return false
    },

    maybeRetreat: function(creep, hostiles) {
        const attacker = _.find(hostiles, h => h.getActiveBodyparts(ATTACK) > 0
                && (h.fatigue === 0 || h.pos.isNearTo(creep.pos))
                && h.pos.inRangeTo(creep.pos, 2));
        if(attacker || creep.hits < creep.hitsMax){
            //retreat
            if(creep.saying === "hold"){
                //get less angry
                creep.memory.anger = creep.memory.anger/2;
            }
            const dangerous = _.filter(hostiles, h => h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0);
            const goals = _.map(dangerous, function(d) {
                return { pos: d.pos, range: 8 }
            });
            const retreatPath = PathFinder.search(creep.pos, goals, {maxOps: 200, flee: true, maxRooms: 1,
                roomCallBack: function(roomName){
                    const room = Game.rooms[roomName];
                    const costs = new PathFinder.CostMatrix;
                    room.find(FIND_CREEPS).forEach(function(c) {
                        costs.set(c.pos.x, c.pos.y, 0xff);
                    });

                    return costs
                }
            });
            creep.moveByPath(retreatPath.path);
            return true
        }
        return false
    },

    aMove: function(creep, hostiles){
        const attacker = _.find(hostiles, h => h.getActiveBodyparts(ATTACK) > 0
                && (h.fatigue === 0 || h.pos.isNearTo(creep.pos))
                && h.pos.inRangeTo(creep.pos, 3));
        if(attacker){
            if(creep.saying === "attack"){
                //get more angry
                creep.memory.anger++;
            }
            const rand = Math.floor(Math.random() * 101);
            if(creep.memory.anger > rand){
                //give chase
                creep.say("attack");
                motion.newMove(creep, attacker.pos, 2);
            } else {
                //hold position
                creep.say("hold");
            }
        } else {
            if(creep.memory.target){
                const target = Game.getObjectById(creep.memory.target);
                if(target){
                    motion.newMove(creep, target.pos, 2);
                    return
                }
            }
            const target = creep.pos.findClosestByRange(hostiles);
            motion.newMove(creep, target.pos, 2);
            creep.memory.target = target.id;
        }
        //move toward an enemy
    },

    removeFlag: function(creep, flagName){
        if(!Memory.flags[flagName]){
            return
        }
        if(creep.pos.roomName == Memory.flags[flagName].roomName){
            const flags = Object.keys(Memory.flags);
            for(var i = 0; i < flags.length; i++){
                if(!flags[i].includes("harass") && Memory.flags[flags[i]].roomName == creep.pos.roomName){
                    return
                }
            }
            delete Memory.flags[flagName];
        }
    },

    init: function(creep){
        if(!creep.memory.target){
            creep.memory.target = null;
        }
        if(!creep.memory.anger){//the more angry the creep gets, the more aggressive it'll get
            creep.memory.anger = 0;//anger increases when hostiles run away, and decreases when hostiles give chase
        }
    },

    maybeHeal: function(creep, hostiles){
        const damager = _.find(hostiles, c => c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0);
        if(creep.hits < creep.hitsMax || damager){
            creep.heal(creep);
        }
    },

    rally: function(creep, flagName){
        const dFlag = Memory.flags[flagName];
        if (dFlag){
            if(creep.pos.roomName === dFlag.roomName){
                //move to center of room
                if(!creep.pos.inRangeTo(25, 25, 8)){
                    motion.newMove(creep, new RoomPosition(25, 25, creep.pos.roomName), 5);
                } else {
                    creep.memory.dormant = true;
                    return true
                }
            } else {
                //move to flag
                motion.newMove(creep, new RoomPosition(dFlag.x, dFlag.y, dFlag.roomName), 5);
            }
        }
        return false
    }
   
};
var harasser = rH;

var CreepState$1 = {
    START: 1,
    BOOST: 2,
    ENGAGE: 3,
    DORMANT: 4,
};
var CS$1 = CreepState$1;

var rD = {
    name: "defender",
    type: "defender",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, 
        RESOURCE_CATALYZED_KEANIUM_ALKALIDE],
   
    /** @param {Creep} creep **/
    run: function(creep) {//modified harasser
        const city = creep.memory.city;
        const holdPoint = 30;
        if (!creep.memory.state) {
            creep.memory.state = CS$1.START;
        }
        let hostiles = [];
        if(creep.memory.state != CS$1.DORMANT){
            hostiles = _.filter(creep.room.find(FIND_HOSTILE_CREEPS), c => !settings_1.allies.includes(c.owner.username));
        }
        switch (creep.memory.state) {
        case CS$1.START:
            rD.init(creep);
            break
        case CS$1.BOOST:
            rD.boost(creep);
            break
        case CS$1.ENGAGE:
            if(!libb.maybeRetreat(creep, hostiles)){
                if(hostiles.length && creep.pos.inRangeTo(Game.spawns[city], holdPoint)){
                    libb.aMove(creep, hostiles);
                } else if(creep.ticksToLive < CREEP_LIFE_TIME) {
                    motion.newMove(creep, Game.spawns[city].pos, holdPoint);
                }
            }
            break
        case CS$1.DORMANT:
            rD.dormant(creep);
            return
        }
        libb.shoot(creep, hostiles);
        libb.maybeHeal(creep, hostiles);
        if(!hostiles.length && creep.hits == creep.hitsMax){
            creep.say("sleep");
            if(creep.saying == "sleep"){
                motion.newMove(creep, Game.spawns[creep.memory.city].room.controller.pos, 2);
            }
            if(creep.pos.inRangeTo(Game.spawns[creep.memory.city].room.controller, 2)){
                creep.memory.state = CS$1.DORMANT;
            }
        }
    },


    init: function(creep){//same init as harasser for now
        if(!creep.memory.target){
            creep.memory.target = null;
        }
        if(!creep.memory.anger){//the more angry the creep gets, the more aggressive it'll get
            creep.memory.anger = 0;//anger increases when hostiles run away, and decreases when hostiles give chase (see rH.aMove)
        }
        if(creep.memory.needBoost){
            creep.memory.state = CS$1.BOOST;
        } else {
            creep.memory.state = CS$1.ENGAGE;
        }
    },

    boost: function(creep){
        if(creep.memory.boosted){
            creep.memory.state = CS$1.ENGAGE;
            return
        }
        actions_1.getBoosted(creep);
        return
        //get boosted, may get boosted using same method as offensive creeps
    },

    engage: function(creep){
        return creep
        //TODO
        //attack designated weak target, or nearest target if no designation
    },

    dormant: function(creep){
        if(Game.spawns[creep.memory.city].memory.towersActive){
            creep.memory.state = CS$1.ENGAGE;
        }
        return creep
        //if in a safe space, hibernate until towers active
    },

    iOwn: function(roomName) {
        var room = Game.rooms[roomName];
        return (room && room.controller && room.controller.my)
    }
};
var defender = rD;

var libz = upgrader;

var rB = {
    name: "builder",
    type: "builder",
    boosts: [RESOURCE_CATALYZED_LEMERGIUM_ACID],

    /** @param {Creep} creep **/
    run: function(creep) {
        //get boosted if needed
        if(creep.memory.needBoost && !creep.memory.boosted){
            const boost = "XLH2O";
            libz.getBoosted(creep, boost);
            return
        }

        const rcl = Game.spawns[creep.memory.city].room.controller.level;
        
        rB.decideWhetherToBuild(creep);
        if(creep.memory.building){
            if(!rB.build(creep)){
                if(rcl >= 4){
                    rB.repWalls(creep);
                } else {
                    rB.repair(creep);
                }
            }
        } else {
            rB.getEnergy(creep);
        }
    },

    repair: function(creep){
        const needRepair = _.find(creep.room.find(FIND_STRUCTURES), structure => (structure.hits < (0.4*structure.hitsMax)) && (structure.structureType != STRUCTURE_WALL) && (structure.structureType != STRUCTURE_RAMPART));
        if (needRepair) {
            creep.memory.repair = needRepair.id;
            return actions_1.repair(creep, needRepair)
        } else if(Game.time % 100 == 0 
            && !Game.spawns[creep.memory.city].room.find(FIND_MY_CONSTRUCTION_SITES).length ){
            creep.memory.role = libz.name;
        }
    },

    getEnergy: function(creep) {
        var location = utils.getStorage(Game.spawns[creep.memory.city].room);
        if((location.store.energy < 300 && location.room.controller.level > 1) || (location.structureType != STRUCTURE_SPAWN && location.store.energy < 800)){
            return
        }
        if (actions_1.withdraw(creep, location) == ERR_NOT_ENOUGH_RESOURCES) {
            var targets = utils.getWithdrawLocations(creep);
            creep.memory.target = utils.getNextLocation(creep.memory.target, targets);
        }
    },

    build: function(creep){
        if(creep.memory.build){//check for site and build
            const site = Game.getObjectById(creep.memory.build);
            if(site){//if there is a build site, build it, else set build to null
                //build site
                if(creep.build(site) === ERR_NOT_IN_RANGE){
                    motion.newMove(creep, site.pos, 3);
                }
                return true
            } else {
                creep.memory.build = null;
            }
        }
        if(!creep.memory.nextCheckTime || creep.memory.nextCheckTime < Game.time){//occasionally scan for construction sites
            //if room is under siege (determined by presence of a defender),
            // ignore any construction sites outside of wall limits
            var targets = Game.spawns[creep.memory.city].room.find(FIND_MY_CONSTRUCTION_SITES);
            var siege = _.find(creep.room.find(FIND_MY_CREEPS), c => c.memory.role == defender.name) 
                && !Game.spawns[creep.memory.city].room.controller.safeMode;
            if(siege){
                const plan = creep.room.memory.plan;
                targets = _.reject(targets, site => (site.pos.x > plan.x + template.dimensions.x
                        || site.pos.y > plan.y + template.dimensions.y
                        || site.pos.x < plan.x
                        || site.pos.y < plan.y)
                        && !(site.structureType == STRUCTURE_RAMPART || site.structureType == STRUCTURE_WALL));
            }
            if(targets.length){
                var targetsByCost = _.sortBy(targets, target => target.progressTotal);
                creep.memory.build = targetsByCost[0].id;
                return true
            }
            creep.memory.nextCheckTime = Game.time + 100;
        }
        return false
    },

    repWalls: function(creep){
        const lookTime = 5;
        if(creep.memory.repair){//check for target and repair
            const target = Game.getObjectById(creep.memory.repair);
            if(target){//if there is a target, repair it
                if(creep.repair(target) === ERR_NOT_IN_RANGE){
                    const box = creep.pos.roomName == Game.spawns[creep.memory.city].pos.roomName 
                        && Game.spawns[creep.memory.city].memory.towersActive 
                        && motion.getBoundingBox(creep.room);
                    if(box){
                        box.top--;
                        box.bottom++;
                        box.left--;
                        box.right++;
                    }
                    motion.newMove(creep, target.pos, 3, true, box);
                }
            } else {
                creep.memory.repair = null;
            }
        }
        if((creep.store.getFreeCapacity() == 0 && Game.time % lookTime == 0) || !creep.memory.repair){//occasionally scan for next target to repair
            const buildings = Game.spawns[creep.memory.city].room.find(FIND_STRUCTURES);
            const nukeRampart = rB.getNukeRampart(buildings, Game.spawns[creep.memory.city].room);
            if(nukeRampart){
                creep.memory.repair = nukeRampart.id;
                return
            }
            const walls = _.filter(buildings, struct => [STRUCTURE_RAMPART, STRUCTURE_WALL].includes(struct.structureType) && !utils.isNukeRampart(struct.pos));
            if(walls.length){//find lowest hits wall
                const minWall = _.min(walls, wall => wall.hits);
                creep.memory.repair = minWall.id;
                return
            }
        }
        return
    },

    getNukeRampart: function(structures, room){
        const nukes = room.find(FIND_NUKES);
        if(!nukes.length){
            return null
        }
        const ramparts = _.filter(structures, s => s.structureType == STRUCTURE_RAMPART && utils.isNukeRampart(s.pos));
        for(const rampart of ramparts){
            let hitsNeeded = 0;
            for(const nuke of nukes){
                if(rampart.pos.isEqualTo(nuke.pos)){
                    hitsNeeded += 5000000;
                }
                if(rampart.pos.inRangeTo(nuke.pos, 2)){
                    hitsNeeded += 5000000;
                }
            }
            if(hitsNeeded > 0 && hitsNeeded + 50000 > rampart.hits){
                return rampart
            }
        }
        return null
    },

    decideWhetherToBuild: function(creep) {
        if(creep.store.energy == 0 && creep.memory.building) {
            creep.memory.building = false;
        }
        if(creep.store.energy == creep.store.getCapacity() && !creep.memory.building) {
            creep.memory.building = true;
        }
    }
};
var builder = rB;

var rU = {
    name: "upgrader",
    type: "normal",
    target: 0,
    boosts: [RESOURCE_CATALYZED_GHODIUM_ACID],

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.needBoost && !creep.memory.boosted){
            rU.getBoosted(creep, rU.boosts[0]);
            return
        }
        creep.store.energy > 0 ? actions_1.upgrade(creep) : rU.getEnergy(creep);
        if(Game.time % 50 == 0){
            rU.checkConstruction(creep);
        }
    },

    checkConstruction: function(creep){
        if(!creep.memory.boosted){
            if(creep.room.find(FIND_MY_CONSTRUCTION_SITES).length 
                && creep.room.controller.ticksToDowngrade > 3000){
                creep.memory.role = builder.name;
            }
        }
    },

    getEnergy: function(creep){
        const link = rU.getUpgradeLink(creep);
        if(link){
            actions_1.withdraw(creep, link);
            return
        }
        builder.getEnergy(creep);
    },
    // Get the upgrade link. Check creep memory, then lib. May return null
    getUpgradeLink: function(creep) {
        var link$1 = Game.getObjectById(creep.memory.upgradeLink);
        link$1 = link$1 || link.getUpgradeLink(creep.room);
        if (link$1) {
            creep.memory.upgradeLink = link$1.id;
            return link$1
        } else {
            return null
        }
    },

    getBoosted: function(creep, boost){
        if(creep.spawning){
            return
        }
        const labs = Object.keys(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers);
        for(const labId of labs){
            const lab = Game.getObjectById(labId);
            if(!lab){
                continue
            }
            if(lab.mineralType == boost){
                //boost self
                if (lab.boostCreep(creep) === ERR_NOT_IN_RANGE) {
                    motion.newMove(creep, lab.pos, 1);
                } else {
                    creep.memory.boosted = true;
                }
                return
            }
        }
        creep.memory.boosted = true;
    }
};
var upgrader = rU;

var CreepState = {
    START: 1,
    SPAWN: 2,
    ENABLE_POWER: 3,
    WORK_SOURCE: 4,
    WORK_GENERATE_OPS: 5,
    WORK_RENEW: 6,
    WORK_DECIDE: 7,
    WORK_FACTORY: 8,
    WORK_BALANCE_OPS: 9,
    SLEEP: 10,
    WORK_OBSERVER: 11,
    WORK_EXTENSION: 12,
    WORK_SPAWN: 13,
    WORK_CONTROLLER: 14,
};
var CS = CreepState;

var rPC = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.shard)
            creep.memory.shard = creep.shard;
        if(creep.memory.shard && creep.memory.shard != Game.shard.name){
            return
        }
        if(creep.ticksToLive == 1){
            Game.notify(`PC ${creep.name} died in ${creep.room.name}. Last state: ${creep.memory.state}`);
        }
        if(creep.hits < creep.hitsMax && creep.memory.city){
            creep.moveTo(Game.rooms[creep.memory.city].storage);
            return
        }
        if (!rPC.hasValidState(creep)) {
            if (creep.ticksToLive > 0) {
                // disabled suicide bc 8 hour delay. creep.suicide()
                return
            }
            creep.memory.state = CS.START;
        }
        switch (creep.memory.state) {
        case CS.START:
            rPC.initializePowerCreep(creep);
            break
        case CS.SPAWN:
            rPC.spawnPowerCreep(creep);
            break
        case CS.ENABLE_POWER:
            actions_1.enablePower(creep);
            break
        case CS.WORK_SOURCE:
            actions_1.usePower(creep, Game.getObjectById(creep.memory.target), PWR_REGEN_SOURCE);
            break
        case CS.WORK_GENERATE_OPS:
            creep.usePower(PWR_GENERATE_OPS);
            break
        case CS.WORK_DECIDE:
            break
        case CS.WORK_RENEW:
            actions_1.renewPowerCreep(creep, Game.getObjectById(creep.memory.powerSpawn));
            break
        case CS.WORK_FACTORY:
            actions_1.usePower(creep, Game.getObjectById(creep.memory.target), PWR_OPERATE_FACTORY);
            break
        case CS.WORK_BALANCE_OPS:
            if (creep.store[RESOURCE_OPS] > POWER_INFO[PWR_OPERATE_FACTORY].ops) {
                actions_1.charge(creep, creep.room.terminal);
            } {
                actions_1.withdraw(creep, creep.room.terminal, RESOURCE_OPS);
            }
            break
        case CS.SLEEP:
            break
        case CS.WORK_OBSERVER:
            actions_1.usePower(creep, Game.getObjectById(creep.memory.target), PWR_OPERATE_OBSERVER);
            break
        case CS.WORK_EXTENSION:
            actions_1.usePower(creep, Game.getObjectById(creep.memory.target), PWR_OPERATE_EXTENSION);
            break
        case CS.WORK_SPAWN:
            actions_1.usePower(creep, Game.getObjectById(creep.memory.target), PWR_OPERATE_SPAWN);
            break
        case CS.WORK_CONTROLLER:
            actions_1.usePower(creep, creep.room.controller, PWR_OPERATE_CONTROLLER);
        }
        creep.memory.state = rPC.getNextState(creep);
    },

    getNextState: function(creep) {
        switch (creep.memory.state) {
        case CS.START: return creep.memory.city ? CS.SPAWN : CS.START
        case CS.SPAWN: return (creep.spawnCooldownTime > Date.now()) ? CS.SPAWN :
            rPC.isPowerEnabled(creep) ? rPC.getNextWork(creep) : CS.ENABLE_POWER
        case CS.ENABLE_POWER: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.ENABLE_POWER
        case CS.WORK_SOURCE: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_SOURCE
        case CS.WORK_FACTORY: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_FACTORY
        case CS.WORK_GENERATE_OPS: return rPC.getNextWork(creep)
        case CS.WORK_DECIDE: return rPC.getNextWork(creep)
        case CS.WORK_RENEW: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_RENEW
        case CS.WORK_BALANCE_OPS: return rPC.atTarget(creep) ? CS.SLEEP : CS.WORK_BALANCE_OPS
        case CS.SLEEP: return Game.time % 10 == 0 ? rPC.getNextWork(creep) : CS.SLEEP
        case CS.WORK_OBSERVER: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_OBSERVER
        case CS.WORK_EXTENSION: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_EXTENSION
        case CS.WORK_SPAWN: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_SPAWN
        case CS.WORK_CONTROLLER: return rPC.atTarget(creep) ? rPC.getNextWork(creep) : CS.WORK_CONTROLLER
        }
        // If state is unknown then restart
        return CS.START
    },

    initializePowerCreep: function(creep) {
        if(Game.time % 10 != 0) return
        if (!creep.memory.city) {
            const cities = utils.getMyCities();
            const usedRooms = _(Game.powerCreeps)
                .map(pc => pc.memory.city)
                .value();
            const citiesWithoutAnyPC = _.filter(cities, city => city.controller.level == 8
                && utils.getFactory(city) && !utils.getFactory(city).level
                && !usedRooms.includes(city.name));
            Log.info(`PowerCreep ${creep.name} is unassigned, please assign using PCAssign(name, city). Available cities on this shard are ${citiesWithoutAnyPC}`);
        }
    },

    spawnPowerCreep: function(creep) {
        // spawn creep
        if(!Game.rooms[creep.memory.city]){
            Log.error(`PC ${creep.name} is unable to spawn`);
            return
        }
        const structures = Game.rooms[creep.memory.city].find(FIND_MY_STRUCTURES);
        const powerSpawn = _.find(structures, structure => structure.structureType === STRUCTURE_POWER_SPAWN);
        if(!powerSpawn){
            return
        }
        creep.spawn(powerSpawn);
        creep.memory.powerSpawn = powerSpawn.id;
    },

    hasValidState: function(creep) { // TODO. false if creep spawns in city with no power spawn
        const validSpawn = creep.memory.state == CS.START || 
                         creep.memory.state == CS.SPAWN || (creep.room && creep.room.controller);
        const initialized = creep.memory.state && creep.memory.city;
        return initialized && validSpawn
    },

    atTarget: function(creep) {
        var target;
        var distance = 1;
        switch (creep.memory.state) {
        case CS.WORK_SOURCE:
        case CS.WORK_FACTORY:
        case CS.WORK_OBSERVER:
        case CS.WORK_EXTENSION:
        case CS.WORK_SPAWN:
        case CS.WORK_CONTROLLER:
            target = Game.getObjectById(creep.memory.target);
            distance = 3;
            break
        case CS.WORK_BALANCE_OPS:
            target = creep.room.terminal;
            break
        case CS.ENABLE_POWER:
            target = creep.room.controller;
            break
        case CS.WORK_RENEW:
            target = Game.getObjectById(creep.memory.powerSpawn);
            break
        }
        return target && creep.pos.inRangeTo(target, distance)
    },

    /*
     * Get next job. Priorities:
     * 1. Renew (extend life if time to live is low)
     * 2. Generate Ops (generate additional ops to spend on other work)
     * 3. Power sources (power up any source that requires it. Cost 0)
     * 4. Power factories (power a factor. cost 100)
     */
    getNextWork: function(creep) {
        if (creep.ticksToLive < 300) return CS.WORK_RENEW
        if (rPC.canGenerateOps(creep)) return CS.WORK_GENERATE_OPS
        if (rPC.hasSourceUpdate(creep)) return CS.WORK_SOURCE
        if (rPC.canOperateFactory(creep)) return rPC.getOpsJob(creep, PWR_OPERATE_FACTORY, CS.WORK_FACTORY)
        //if (rPC.canOperateObserver(creep)) return rPC.getOpsJob(creep, PWR_OPERATE_OBSERVER, CS.WORK_OBSERVER)
        if (rPC.canOperateExtension(creep)) return rPC.getOpsJob(creep, PWR_OPERATE_EXTENSION, CS.WORK_EXTENSION)
        if (rPC.canOperateSpawn(creep)) return rPC.getOpsJob(creep, PWR_OPERATE_SPAWN, CS.WORK_SPAWN)
        if (rPC.canOperateController(creep)) return rPC.getOpsJob(creep, PWR_OPERATE_CONTROLLER, CS.WORK_CONTROLLER)
        if (rPC.hasExtraOps(creep)) return CS.WORK_BALANCE_OPS
        return CS.SLEEP
    },

    isPowerEnabled: function(creep) {
        const room = Game.rooms[creep.memory.city];
        return (room.controller && room.controller.isPowerEnabled)
    },

    canGenerateOps: function(creep) {
        return creep.powers[PWR_GENERATE_OPS] &&
            creep.powers[PWR_GENERATE_OPS].cooldown == 0 &&
            _.sum(creep.store) < creep.store.getCapacity()
    },

    hasSourceUpdate: function(creep) {
        // powerup runs out every 300 ticks
        // get all sources
        // if there is no effect on source then choose it
        if(!creep.powers[PWR_REGEN_SOURCE]){
            return false
        }
        const sourceIds = Object.keys(Game.spawns[creep.memory.city + "0"].memory.sources);
        for (const sourceId of sourceIds) {
            const source = Game.getObjectById(sourceId);
            if (!source.effects || source.effects.length == 0 ||
                source.effects[0].ticksRemaining < 30) {
                creep.memory.target = sourceId;
                return true
            }
        }
        return false
    },

    canOperateFactory: function(creep) {
        const factory = _.find(creep.room.find(FIND_MY_STRUCTURES), struct => struct.structureType == STRUCTURE_FACTORY);
        const city = creep.memory.city + "0";
        const spawn = Game.spawns[city];
        const isRunning = spawn && spawn.memory.ferryInfo.factoryInfo.produce !== "dormant";
        const isNew = factory && !factory.level;
        const needsBoost = (factory && factory.cooldown < 30 && isRunning) || isNew;
        return rPC.canOperate(creep, factory, PWR_OPERATE_FACTORY, needsBoost)
    },

    canOperateObserver: function(creep) {
        const observer = _.find(creep.room.find(FIND_MY_STRUCTURES), struct => struct.structureType == STRUCTURE_OBSERVER);
        return rPC.canOperate(creep, observer, PWR_OPERATE_OBSERVER, true)
    },

    canOperateExtension: function(creep) {
        return rPC.canOperate(creep, creep.room.storage, PWR_OPERATE_EXTENSION,
            creep.room.energyAvailable < 0.8 * creep.room.energyCapacityAvailable)
    },

    canOperateSpawn: function(creep) {
        const spawn = Game.spawns[creep.memory.city + "0"];
        const spawns = spawn && spawn.room.find(FIND_MY_SPAWNS) || [];
        if(_.every(spawns, s => s.spawning)){
            const slowSpawn = _.find(spawns, s => !s.effects || s.effects.length == 0);
            if(slowSpawn){
                return rPC.canOperate(creep, slowSpawn, PWR_OPERATE_SPAWN, true)
            }
        }
        return false
    },

    canOperateController: function(creep) {
        if(Game.spawns[creep.memory.city + "0"].memory[libz.name] > 0){
            return rPC.canOperate(creep, creep.room.controller, PWR_OPERATE_CONTROLLER, true)
        } else {
            return false
        }
    },

    canOperate: function(creep, target, power, extraRequirements) {
        if (target &&
            (!target.effects || target.effects.length == 0) &&
            creep.powers[power] &&
            creep.powers[power].cooldown == 0 && extraRequirements) {
            creep.memory.target = target.id;
            return true
        }
        return false
    },

    hasExtraOps: function(creep) {
        return creep.store[RESOURCE_OPS] == creep.store.getCapacity()
    },

    getOpsJob: function(creep, jobName, jobState) {
        return creep.store[RESOURCE_OPS] >= POWER_INFO[jobName].ops ?
            jobState : CS.WORK_BALANCE_OPS
    }
};
var powerCreep = rPC;

var rR = {
    name: "runner",
    type: "runner",
    target: 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.flag && creep.memory.flag.includes("powerMine")){
            rR.runPower(creep);
            return
        }
        if(creep.memory.juicer && rR.runController(creep)){
            return
        }
        if(creep.memory.tug){
            rR.runTug(creep);
            return
        }
        // notice if there's stuff next to you before wandering off!  
        if (Game.cpu.bucket > 9500 || Game.time % 2) {
            actions_1.notice(creep); // cost: 15% when running, so 7% now
        }
        if(creep.memory.target == 1 && creep.store.getUsedCapacity() == 0)
            creep.memory.target = 0;
        if(creep.memory.target == 0 && creep.store.getFreeCapacity() < 0.5 * creep.store.getCapacity()){
            creep.memory.target = 1;
            creep.memory.targetId = null;
        }
        if(creep.memory.target == 0 && !creep.memory.targetId){
            rR.checkForPullees(creep);
        }
        // if there's room for more energy, go find some more
        // else find storage
        if (creep.memory.target == 0 && !creep.memory.tug) {
            if(!rR.pickup(creep) && Game.cpu.bucket > 9500){
                rR.runController(creep);
            }
        } else {
            rR.deposit(creep);
        }
    },

    flipTarget: function(creep) {
        creep.memory.target = utils.getNextLocation(creep.memory.target, utils.getTransferLocations(creep));
    },

    checkForPullees: function(creep){
        const pullee = _.find(creep.room.find(FIND_MY_CREEPS), c => c.memory.destination && !c.memory.paired);
        if(pullee){
            creep.memory.tug = true;
            creep.memory.pullee = pullee.id;
            pullee.memory.paired = true;
        }
    },

    runController: function(creep){
        if(creep.saying == "*" && creep.store.energy == 0){
            creep.memory.juicer = false;
            return false
        }
        const link = libz.getUpgradeLink(creep);
        if(!link) return false
        if(!creep.memory.juicer && link.store.getFreeCapacity(RESOURCE_ENERGY) == 0) return false
        creep.memory.juicer = true;
        if(creep.store.energy > 0){
            if(actions_1.charge(creep, link) == 1){
                creep.say("*");
            }
            if(link.store.getFreeCapacity(RESOURCE_ENERGY) == 0){
                const upgrader = _.find(creep.room.find(FIND_MY_CREEPS), c => c.memory.role == libz.name);
                if(!upgrader){
                    creep.memory.juicer = false;
                    return false
                }
            }
        } else {
            if (!creep.memory.location || !Game.getObjectById(creep.memory.location))
                creep.memory.location =  utils.getStorage(Game.spawns[creep.memory.city].room).id;
            const target = Game.getObjectById(creep.memory.location);
            actions_1.withdraw(creep, target);
        }
        return true
    },

    pickup: function(creep) {
        if(creep.memory.targetId) {
            const target = Game.getObjectById(creep.memory.targetId);
            if(target){
                if(target.store){
                    let max = 0;
                    let maxResource = null;
                    for(const resource in target.store){
                        if(target.store[resource] > max){
                            max = target.store[resource];
                            maxResource = resource;
                        }
                    }
                    if(actions_1.withdraw(creep, target, maxResource) == 1)
                        creep.memory.targetId = null;
                } else {
                    if(actions_1.pick(creep, target) == 1)
                        creep.memory.targetId = null;
                }
                return true
            }
        }
        const goodLoads = utils.getGoodPickups(creep);
        if(!goodLoads.length)
            return false
        const newTarget = _.min(goodLoads, function(drop){
            const distance = PathFinder.search(creep.pos, drop.pos).cost;
            const amount = drop.amount || drop.store.getUsedCapacity();
            return distance/amount
        });
        creep.memory.targetId = newTarget.id;
        return rR.pickup(creep)
    },

    deposit: function(creep){
        if (!creep.memory.location || !Game.getObjectById(creep.memory.location))
            creep.memory.location =  utils.getStorage(Game.spawns[creep.memory.city].room).id;
        const target = Game.getObjectById(creep.memory.location);
        if (actions_1.charge(creep, target) == ERR_FULL) 
            creep.memory.location =  utils.getStorage(Game.spawns[creep.memory.city].room).id;
    },

    runTug: function(creep){
        const pullee = Game.getObjectById(creep.memory.pullee);
        if(!pullee){
            creep.memory.tug = false;
            return
        }
        if(creep.fatigue)
            return
        const destination = new RoomPosition(pullee.memory.destination.x, pullee.memory.destination.y, pullee.memory.destination.roomName);
        if((utils.isOnEdge(creep.pos) && utils.isNearEdge(pullee.pos)) || (utils.isOnEdge(pullee.pos) && utils.isNearEdge(creep.pos))){
            rR.runBorderTug(creep, pullee, destination);
            return
        }
        if(!pullee.pos.isNearTo(creep.pos)){
            motion.newMove(creep, pullee.pos, 1);
            return
        }
        if(creep.pos.isEqualTo(destination)){
            creep.move(pullee);
            creep.pull(pullee);
            pullee.move(creep);
            creep.memory.tug = false;
            return
        } else if(creep.ticksToLive == 1){
            pullee.memory.paired = false;
        }
        const range = new RoomPosition(destination.x, destination.y, destination.roomName).isEqualTo(pullee.memory.sourcePos.x, pullee.memory.sourcePos.y)  ? 1 : 0;
        motion.newMove(creep, destination, range);
        creep.pull(pullee);
        pullee.move(creep);
    },

    runBorderTug: function(creep, pullee, destination){
        if(utils.isOnEdge(creep.pos) && !utils.isOnEdge(pullee.pos)){
            creep.move(pullee);
            creep.pull(pullee);
            pullee.move(creep);
            return
        }
        const endRoom = pullee.memory.destination.roomName;
        const roomDataCache = utils.getsetd(Cache, "roomData", {});
        const nextRoomDir = Game.map.findExit(creep.pos.roomName, endRoom, {
            routeCallback: function(roomName){
                if(utils.isHighway(roomName)) return 1
                if(Game.map.getRoomStatus(roomName).status != "normal") return Infinity
                const roomData = utils.getsetd(roomDataCache, roomName, {});
                if(Memory.remotes[roomName]) return 1
                if(roomData.owner && !settings_1.allies.includes(roomData.owner)) return 50
                if(Memory.remotes[roomName]) return 1
                return 50
            }
        });
        const nextRoom = Game.map.describeExits(creep.pos.roomName)[nextRoomDir];
        if(utils.isOnEdge(creep.pos) && utils.isOnEdge(pullee.pos)){
            //_cp_
            //_pc_
            //_b__
            //__b_
            let direction = null;
            if(creep.pos.x == 0){
                direction = RIGHT;
            } else if(creep.pos.x == 49){
                direction = LEFT;
            } else if(creep.pos.y == 0){
                direction = BOTTOM;
            } else {
                direction = TOP;
            }
            creep.move(direction);
            return
        }
        const sameRoom = creep.pos.roomName == pullee.pos.roomName;
        let direction = null;
        if(pullee.pos.x == 0){
            direction = LEFT;
        } else if(pullee.pos.x == 49){
            direction = RIGHT;
        } else if(pullee.pos.y == 0){
            direction = TOP;
        } else {
            direction = BOTTOM;
        }
        if(sameRoom && (creep.pos.roomName == endRoom || direction != nextRoomDir)){
            if(!creep.pos.isNearTo(pullee.pos)){
                motion.newMove(creep, pullee.pos, 1);
                return
            }
            const range = new RoomPosition(destination.x, destination.y, destination.roomName).isEqualTo(pullee.memory.sourcePos.x, pullee.memory.sourcePos.y)  ? 1 : 0;
            motion.newMove(creep, destination, range);
            creep.pull(pullee);
            pullee.move(creep);
            return
        }
        if(!sameRoom && (pullee.pos.roomName == endRoom || pullee.pos.roomName == nextRoom)){
            creep.move(nextRoomDir);
        }
        //cases
        //_p_c --> do nothing
        //cp__ --> do nothing
    },

    runPower: function(creep){
        if (_.sum(creep.store) > 0){
            if (!creep.memory.location){
                creep.memory.location = Game.spawns[creep.memory.city].room.storage.id;
            }
            const target = Game.getObjectById(creep.memory.location);
            if (target){
                actions_1.charge(creep, target);
            }
            return
        }
        //check for flag
        const flagName = creep.memory.flag || creep.memory.city + "powerMine";
        const flag = Memory.flags[flagName];
        if (flag && flag.roomName !== creep.pos.roomName){
            //move to flag range 5
            motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), 5);
            return
        }
        if (flag) {
            const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);
            //check for resources under flag
            const resource = Game.rooms[flag.roomName].lookForAt(LOOK_RESOURCES, flagPos);
            if (resource.length){
                //pickup resource
                if (creep.pickup(resource[0]) == ERR_NOT_IN_RANGE){
                    motion.newMove(creep, flagPos, 1);
                }

                return
            }
            const ruin = Game.rooms[flag.roomName].lookForAt(LOOK_RUINS, flagPos);
            if (ruin.length){
                //pickup resource
                if (creep.withdraw(ruin[0], RESOURCE_POWER) == ERR_NOT_IN_RANGE)
                    motion.newMove(creep, flagPos, 1);
                return
            }
            //move to flag
            if (!creep.pos.inRangeTo(flagPos, 4))
                motion.newMove(creep, flagPos, 4);
            // every 50 ticks check for powerbank
            if (Game.time % 50 == 0){
                const powerBank = Game.rooms[flag.roomName].lookForAt(LOOK_STRUCTURES, flagPos);
                // if no powerbank, remove flag
                if (!powerBank.length)
                    delete Memory.flags[flagName];
            }
            return
        }
        if (Game.time % 50 == 0)
            creep.suicide();
    }
    
};
var runner = rR;

var rMe = {
    name: "medic",
    type: "medic",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, 
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE],

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.needBoost && !creep.memory.boosted){
            return actions_1.getBoosted(creep)
        }
        rMe.init(creep);
        const partner = Game.getObjectById(creep.memory.partner);
        if(!partner){
            //if partner is dead, suicide
            if(rMe.endLife(creep)){
                return
            }
            //if creep not matched, wait to be picked up
        }
    },  

    init: function(creep){
        if (!creep.memory.partner){
            creep.memory.partner = null;
        }
    },

    endLife: function(creep){
        if(creep.memory.partner == null){
            return false
        } else {
            creep.suicide();
            return true
        }
    }


   
};
var medic = rMe;

var rBr = {
    name: "breaker",
    type: "breaker",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ACID],

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.needBoost && !creep.memory.boosted){
            return actions_1.getBoosted(creep)
        }
        utils.updateCheckpoints(creep);
        rBr.init(creep);
        const medic = Game.getObjectById(creep.memory.medic);
        if(!medic){
            if(rBr.endLife(creep)){
                return
            } else {
                rBr.medicSearch(creep);
                return
            }
        }
        //breaker has a medic
        const canMove = rBr.canMove(creep, medic);
        let target = Game.getObjectById(creep.memory.target);
        const targetFlag = Memory.flags[creep.memory.city + "breakTarget"];
        if(targetFlag){
            if(Game.rooms[targetFlag.roomName]){
                const structures = Game.rooms[targetFlag.roomName].lookForAt(LOOK_STRUCTURES, targetFlag.x, targetFlag.y);
                if(structures.length){
                    target = structures[0];
                } else {
                    delete Memory.flags[creep.memory.city + "breakTarget"];
                }
            }
        }
        //attempt to break target,
        //if target is not in range and there is another valid target in range, break new valid target
        //if target cannot be pathed to, choose new target to be saved as target
        rBr.breakStuff(creep, target);
        if(!rBr.maybeRetreat(creep, medic, canMove)){
            rBr.advance(creep, medic, target, canMove);
        }
        rBr.heal(creep, medic);
    },

    init: function(creep){
        //initialize memory
        if(!creep.memory.medic){
            creep.memory.medic = null;
        }
    },

    endLife: function(creep) {
        // if creep had a medic but no longer does then suicide
        if(creep.memory.medic){
            creep.suicide();
            return true
        }
        return false
    },

    medicSearch: function(creep){
        //find single medics in your neighborhood
        const creeps = creep.room.find(FIND_MY_CREEPS);
        let medic$1;
        if(creep.memory.boosted && creep.memory.role == rBr.name){
            medic$1 = _.find(creeps, c => c.memory.role == medic.name && !c.memory.partner && c.memory.boosted);
        } else {
            medic$1 = _.find(creeps, c => c.memory.role == medic.name && !c.memory.partner && !c.memory.needBoost);
        }
        if(medic$1){
            medic$1.memory.partner = creep.id;
            creep.memory.medic = medic$1.id;
        }
    },

    canMove: function(creep, medic){
        //can only move if both creeps are not fatigued OR one of the creeps is on a room edge
        if((creep.pos.isNearTo(medic) && !creep.fatigue && !medic.fatigue) || utils.isOnEdge(creep.pos) || utils.isOnEdge(medic.pos)){
            return true
        } else {
            return false
        }
    },

    breakStuff: function(creep, target) {
        if(target && target.pos.isNearTo(creep.pos)){
            creep.dismantle(target);
            return
            // if next to target, break it
        }
        // if next to enemy structure, break it
        if(creep.room.controller && (creep.room.controller.owner && settings_1.allies.includes(creep.room.controller.owner.username)
            || creep.room.controller.reservation && settings_1.allies.includes(creep.room.controller.reservation.username)))
            return
        const structures = creep.room.lookForAtArea(LOOK_STRUCTURES,
            Math.max(0, creep.pos.y - 1),
            Math.max(0, creep.pos.x - 1),
            Math.min(49, creep.pos.y + 1),
            Math.min(49, creep.pos.x + 1), true); //returns an array of structures
        if(structures.length){
            creep.dismantle(structures[0].structure);
        }
    },

    maybeRetreat: function(creep, medic, canMove){//always back out (medic leads retreat)
        const checkpoint = creep.memory.checkpoints && new RoomPosition(creep.memory.checkpoints[0].x,
            creep.memory.checkpoints[0].y,
            creep.memory.checkpoints[0].roomName);
        if(!creep.memory.tolerance){
            const heals = medic.getActiveBodyparts(HEAL);
            creep.memory.tolerance = HEAL_POWER * (creep.memory.boosted ? heals * BOOSTS[HEAL][RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE][HEAL]: heals);
        }
        //retreat if necessary
        //if retreating, determine when it is safe to resume attack
        //possibly use avoid towers
        const hostiles = utils.findHostileCreeps(creep.room);
        let damage = 0;
        const duo = [creep, medic];


        const melee = _.filter(hostiles, c => !c.level && c.getActiveBodyparts(ATTACK));
        const ranged = _.filter(hostiles, c => !c.level && c.getActiveBodyparts(RANGED_ATTACK));
        for(const member of duo){
            for(const attacker of melee){
                if(member.pos.isNearTo(attacker.pos) ||(member.pos.inRangeTo(attacker.pos, 2) && !attacker.fatigue)){
                    damage += utils.getCreepDamage(attacker, ATTACK);
                }
            }
            for(const ranger of ranged){
                if(member.pos.inRangeTo(ranger.pos, 3) ||(member.pos.inRangeTo(ranger.pos, 4) && !ranger.fatigue)){
                    damage += utils.getCreepDamage(ranger, RANGED_ATTACK);
                }
            }
        }


        if((damage > creep.memory.tolerance || creep.hits < creep.hitsMax * .9 || medic.hits < medic.hitsMax * .9) && checkpoint && canMove){
            motion.newMove(medic, checkpoint, 1);
            rBr.medicMove(medic, creep);
            return true
        }
        return false
    },

    advance: function(creep, medic, target, canMove){
        if(!canMove && !medic.pos.isNearTo(creep)){
            medic.moveTo(creep, {range: 1});
            return
        }
        if(!canMove) return
        if(target){
            if(target.pos.isNearTo(creep)){
                return //nothing to do if already at target
            }
            if(creep.moveTo(target, {range: 1}) == ERR_NO_PATH){
                //no path to target => find new target
                rBr.findTarget(creep, medic);
                return
            }
            rBr.medicMove(creep, medic); //move medic
            return
        }
        //find new target or follow rally path
        rBr.findTarget(creep,medic);
        // TODO if no target, follow rally path, and attempt to acquire targets along the way
        //if breaker peeks into a room and there is no clear path to every exit,
        // clear a path to every exit before continuing the rally
    },

    getTarget: function(creep, valuableStructures, structures){
        const result = PathFinder.search(creep.pos, _.map(valuableStructures, function(e) {
            return { pos: e.pos, range: 0 }}), {
            plainCost: 1,
            swampCost: 1,
            maxRooms: 1,
            roomCallback: (roomName) => {

                const maxHits = _(structures).max("hits").hits;
                const costs = new PathFinder.CostMatrix;

                // count structure 4 times since quad will hit it in 4 positions
                // the path is relative to the top left creep, __ so a structure in the
                // bottom right needs to be counted against a  _S path through the top left
                const terrain = new Room.Terrain(roomName);
                for (const structure of structures) {
                    const oldCost = costs.get(structure.pos.x, structure.pos.y);
                    const cost = quad.getCost(structure.hits, maxHits, oldCost);
                    costs.set(structure.pos.x, structure.pos.y, cost);
                    if(terrain.get(structure.pos.x, structure.pos.y) & TERRAIN_MASK_WALL)
                        costs.set(structure.pos.x, structure.pos.y, 254);//targettable but otherwise essentially impassable
                }
                const creeps = Game.rooms[roomName].find(FIND_CREEPS);
                for(const c of creeps){
                    costs.set(c.pos.x, c.pos.y, 255);
                }
                return costs
            }
        });
        if (result.incomplete) return false

        const path = result.path;

        const wallInPath = rBr.getWallInPath(creep.room, path);
        if (wallInPath) {
            return wallInPath
        }

        // if nothing is in our path then return the target at the end of the path
        const targetPos = path.pop();
        const targets = targetPos.lookFor(LOOK_STRUCTURES);
        const target = _(targets).min("hits");
        return target
    },

    getWallInPath: function(room, path) {
        const blockingStructures = [STRUCTURE_WALL, STRUCTURE_RAMPART];
        return _(path)
            .map(pos => pos.lookFor(LOOK_STRUCTURES))
            .flatten()
            .find(structure => blockingStructures.includes(structure.structureType))
    },

    findTarget: function(creep, medic){
        const flag = creep.memory.city + "break";
        const structures = creep.room.find(FIND_STRUCTURES, {
            filter: structure => structure.hits && (!structure.owner || !settings_1.allies.includes(structure.owner.username))
        });
        if(!Memory.flags[flag] || creep.pos.roomName == Memory.flags[flag].roomName){
            //we are in destination room, target "valuable" structures
            const valuableStructures = quad.getValuableStructures(structures);
            if (valuableStructures.length) {
                creep.memory.target = rBr.getTarget(creep, valuableStructures, structures).id;
                return
            }
            if (structures.length) {
                creep.memory.target = rBr.getTarget(creep, structures, structures).id;
                return
            }
        }
        if(Memory.flags[flag] && creep.room.name == Memory.flags[flag].roomName && !structures.length){
            delete Memory.flags[flag];
        }
        //if in a friendly room or my room, ignore structures and rally. Else, set nearest structure as target
        if(creep.room.controller && creep.room.controller.owner
                && (settings_1.allies.includes(creep.room.controller.owner.username)
                || creep.room.controller.my)){
            rBr.rally(creep, medic, flag);
        } else {
            rBr.rally(creep, medic, flag);//no valid targets, attempt to continue rally
        }
    },

    rally: function(creep, medic, flagName){
        const flag = Memory.flags[flagName];
        if(flag && creep.room.name != flag.roomName){
            motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), 24);
            rBr.medicMove(creep, medic);
        }
    },

    medicMove: function(creep, medic){
        if(medic.pos.isNearTo(creep.pos)){
            medic.move(medic.pos.getDirectionTo(creep));
        } else {
            motion.newMove(medic, creep.pos, 1);
        }
    },

    heal: function(creep, medic){
        //placeholder logic
        //if creep is in an owned room, heal. Else, only heal if hurt
        if(creep.pos.roomName == medic.pos.roomName){
            if(medic.hits < 0.6 * medic.hitsMax){
                medic.heal(medic);
            } else if(creep.hits < creep.hitsMax){
                medic.heal(creep);
            } else if(medic.hits < medic.hitsMax){
                medic.heal(medic);
            } else if(medic.room.controller && medic.room.controller.owner && !medic.room.controller.my){
                medic.heal(medic);
            }
        } else {
            medic.heal(medic);
        }
    }
};
var breaker = rBr;

var rPM = {
    name: "powerMiner",
    type: "powerMiner",
    boosts: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, RESOURCE_CATALYZED_UTRIUM_ACID],

    /** @param {Creep} creep **/
    run: function(creep) {
        utils.checkRoom(creep);//check if in hostile room

        if (!rPM.getBoosted(creep, rPM.boosts)){
            return
        }

        const medic = Game.getObjectById(creep.memory.medic);
        if(!medic){
            if(breaker.endLife(creep)){
                return
            } else {
                breaker.medicSearch(creep);
                return
            }
        }

        const flagName = creep.memory.flag || creep.memory.city + "powerMine";
        if(!Memory.flags[flagName]){
            creep.suicide();
            medic.suicide();
            return
        }
        if(creep.hits < creep.hitsMax/2 || medic.hits < medic.hitsMax/2){//temp drop operation if under attack
            delete Memory.flags[flagName];
            creep.suicide();
            medic.suicide();
            return
        }

        const canMove = breaker.canMove(creep, medic);

        let bank = Game.getObjectById(creep.memory.target);//target is pBank
        if(!bank) 
            bank = rPM.findBank(creep, flagName);
        const flag = Memory.flags[flagName];
        if(!flag)
            return
        if(!bank && flag.roomName != creep.pos.roomName){
            if(canMove){
                motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), 1);
            }
            breaker.medicMove(creep, medic);
            return
        }
        if(!bank){
            rPM.retreat(creep, medic, flagName);
            return
        }
        const hostile = rPM.roomScan(creep);
        if(hostile && (hostile.pos.inRangeTo(medic.pos, 3) || hostile.pos.inRangeTo(creep.pos, 3))){
            if(!creep.memory.reinforced){
                const harassFlag = utils.generateFlagName(creep.memory.city + "harass");
                Memory.flags[harassFlag] = new RoomPosition(25, 25, creep.room.name);
                creep.memory.reinforced = true;
            }
            creep.attack(hostile);
            breaker.heal(creep,medic);
            if(canMove)
                motion.newMove(creep, hostile.pos, 0);
            breaker.medicMove(creep, medic);
            return
        }
        rPM.hitBank(creep, medic, bank, canMove);
        if(!canMove && !medic.pos.isNearTo(creep.pos)){
            breaker.medicMove(creep, medic);
        }
    },

    hitBank: function(creep, medic, bank, canMove){
        if(canMove && !bank.pos.isNearTo(creep.pos)){
            motion.newMove(creep, bank.pos, 1);
            breaker.medicMove(creep, medic);
        }
        if(bank.pos.isNearTo(creep.pos)){
            if(creep.hits == creep.hitsMax)
                creep.attack(bank);
            medic.heal(creep);
        }
        rPM.summonRunners(creep, bank);
    },

    retreat: function(creep, medic, flagName){
        if(creep.pos.inRangeTo(new RoomPosition(Memory.flags[flagName].x, Memory.flags[flagName].y, Memory.flags[flagName].roomName, 4))){
            breaker.medicMove(medic, creep);
            motion.newMove(medic, new RoomPosition(25, 25, creep.pos.roomName), 5);
        }
    },

    summonRunners: function(creep, bank){
        if(!bank){
            return
        }
        if(!creep.memory.bankInfo){
            creep.memory.bankInfo = {};
            let damage = creep.getActiveBodyparts(ATTACK) * ATTACK_POWER;
            if(creep.memory.boosted){
                damage = damage * BOOSTS[ATTACK][RESOURCE_CATALYZED_UTRIUM_ACID][ATTACK];
            }
            const runnersNeeded = Math.ceil(bank.power/1600);
            const distance  = motion.getRoute(Game.spawns[creep.memory.city].pos.roomName, bank.pos.roomName, true).length * 50;
            const summonTime = distance + (Math.ceil(runnersNeeded/CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][8]) * MAX_CREEP_SIZE * CREEP_SPAWN_TIME);
            creep.memory.bankInfo.summonHits = summonTime * damage;
            creep.memory.bankInfo.runnersNeeded = runnersNeeded;
        }

        if(Game.time % 5 == 1 && bank.hits < creep.memory.bankInfo.summonHits && !creep.memory.bankInfo.runnersSummoned){
            creep.memory.bankInfo.runnersSummoned = true;
            spawnQueue.initialize(Game.spawns[creep.memory.city]);
            for(let i = 0; i < creep.memory.bankInfo.runnersNeeded; i++){
                spawnQueue.schedule(Game.spawns[creep.memory.city], runner.name, false, creep.memory.flag);
            }
        }
    },

    findBank: function(creep, flagName){
        const flag = Memory.flags[flagName];
        if(flag && Game.rooms[flag.roomName]){
            const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);
            const bank = flagPos.lookFor(LOOK_STRUCTURES);
            if(bank.length){
                creep.memory.target = bank[0].id;
                return bank[0]
            } else {
                //if no bank, move away
                const look = flagPos.look();
                if(look.length < 2){//terrain always shows up, so if there is anything else there, leave the flag on
                    delete Memory.flags[flagName];
                }
            }
        }
        return null
    },

    roomScan: function(creep){//not in use. Will be used for self defense / harasser summon
        if(!creep.memory.aware && Game.time % 5 != 0){
            return null
        }
        const hostiles = _.filter(creep.room.find(FIND_HOSTILE_CREEPS), c => settings_1.allies.includes(creep.owner.username) 
            && c.pos.inRangeTo(creep.pos, 9) 
            && (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 || c.pos.isNearTo(creep.pos)));
        if(!hostiles.length){
            creep.memory.aware = false;
            return null
        }
        creep.memory.aware = true;
        const closestHostile = creep.pos.findClosestByRange(hostiles);
        return closestHostile
    },

    attackHostiles: function(creep, bank, hostiles){ //not in use. Will be used for self defense / harasser summon
        if(creep && bank && hostiles)
            return
    },

    getBoosted: function(creep, boosts){
        const alreadyBoosted = creep.memory.boosted && creep.memory.boosted >= boosts.length;
        if (!creep.memory.needBoost || alreadyBoosted) {
            return true
        }

        if(!creep.memory.boosted){
            creep.memory.boosted = 0;
        }
        const boost = boosts[creep.memory.boosted];
        if(creep.spawning){
            return
        }
        const labs = Object.keys(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers);
        for(const labId of labs){
            const lab = Game.getObjectById(labId);
            if(!lab){
                continue
            }
            if(lab.mineralType == boost){
                //boost self
                if (lab.boostCreep(creep) === ERR_NOT_IN_RANGE) {
                    motion.newMove(creep, lab.pos, 1);
                } else {
                    creep.memory.boosted++;
                }
                return
            }
        }
    }
};
var powerMiner = rPM;

var rDM = {
    name: "depositMiner",
    type: "depositMiner",
    target: 0,
    boosts: [RESOURCE_CATALYZED_UTRIUM_ALKALIDE, RESOURCE_CATALYZED_KEANIUM_ACID],

    // Keep track of how much is mined for stats. Stat object will clear this when it's recorded
    mined: 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        utils.checkRoom(creep);
        if (_.sum(creep.store) === 0 && creep.ticksToLive < 500){//if old and no store, suicide
            creep.suicide();
            return
        }

        if (!powerMiner.getBoosted(creep, rDM.boosts)){
            return
        }

        if(creep.memory.target === 0){
            if(_.sum(creep.store) === creep.store.getCapacity()){
                creep.memory.target = 1;
            }
        }
        switch(creep.memory.target){
        case 0: {
            //newly spawned or empty store
            const flagName = creep.memory.flag;
            const flag = Memory.flags[flagName];
            if(!flag){//if there is no flag, change city.memory.depositMiner to 0, and suicide
                creep.suicide();
                return
            }
            const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);
            if(creep.body.length === 3){
                delete Memory.flags[flagName];
                return
            }
            if (flagPos.roomName !== creep.pos.roomName){//move to flag until it is visible
                motion.newMove(creep, flagPos, 1);
                return
            }
            const deposit = Game.rooms[flagPos.roomName].lookForAt(LOOK_DEPOSITS, flagPos);//if flag is visible, check for deposit, if no deposit, remove flag
            if(!deposit.length){
                delete Memory.flags[flagName];
                return
            }
            if(_.sum(creep.store) === 0 && (deposit[0].lastCooldown > 25 && Game.cpu.bucket < settings_1.bucket.resourceMining)){
                delete Memory.flags[flagName];
                return
            }
            //check for enemies. if there is an enemy, call in harasser
            rDM.checkEnemies(creep, deposit[0]);

            //move towards and mine deposit (actions.harvest)
            if(actions_1.harvest(creep, deposit[0]) === 1){
                //record amount harvested
                let works = _.filter(creep.body, part => part.type == WORK).length;
                if(creep.memory.boosted){
                    works = works * BOOSTS.work[RESOURCE_CATALYZED_UTRIUM_ALKALIDE].harvest;
                }
                // record personal work for stats
                if (!creep.memory.mined) {
                    creep.memory.mined = 0;
                }
                creep.memory.mined += works;
                // update harvest total tracker for planning purposes
                if(!Memory.flags[creep.memory.flag])
                    break
                if(!Memory.flags[creep.memory.flag].harvested)
                    Memory.flags[creep.memory.flag].harvested = 0;
                Memory.flags[creep.memory.flag].harvested += works;
            }
            break
        }
        case 1:
            //store is full
            if(_.sum(creep.store) === 0){
                creep.memory.target = 0;
                return
            }
            actions_1.charge(creep, Game.spawns[creep.memory.city].room.storage);

        }
    },

    checkEnemies: function(creep, deposit){
        if(Game.time % 5 == 0 || creep.hits < creep.hitsMax){
            //scan room for hostiles
            const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
            if(rDM.checkAllies(creep, hostiles)){
                return
            }
            const dangerous = _.find(hostiles, h => h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0);
            
            //check for tampering with deposit
            const cooldown = deposit.lastCooldown;
            const expected = Math.ceil(0.001*Math.pow(Memory.flags[creep.memory.flag].harvested,1.2));

            if(cooldown > expected){
                Memory.flags[creep.memory.flag].harvested = Math.ceil(Math.pow((deposit.lastCooldown / 0.001), 1/1.2));
            }
            if(cooldown > expected || dangerous){
                //call in harasser
                const flagName = utils.generateFlagName(creep.memory.city + "harass");
                if(!_.find(Memory.flags, flag => flag.roomName == creep.room.name))
                    utils.placeFlag(flagName, new RoomPosition(25, 25, creep.room.name));
            }
        }
    },

    checkAllies: function(creep, hostiles){
        const owners = _.map(hostiles, hostile => hostile.owner.username);
        const ally = _.find(owners, owner => {
            Log.info(`Is Ally ${owner}: ${settings_1.allies.includes(owner)}`);
            Cache.enemies = Cache.enemies || {};
            Cache.enemies[owner] = Cache.enemies[owner] || 0;
            Cache.enemies[owner]++;
            return settings_1.allies.includes(owner)
        });
        if (ally) {
            //remove flag
            const flag = Memory.flags[creep.memory.flag];
            const allies = _.filter(creep.room.find(FIND_HOSTILE_CREEPS), c => settings_1.allies.includes(c.owner.username));
            for(const friendly of allies){
                if(friendly.getActiveBodyparts(WORK) > 0 && friendly.pos.isNearTo(flag.x, flag.y)){
                    delete Memory.flags[creep.memory.flag];
                    creep.memory.target = 1;
                    return true
                }
            }
        }
        return false
    }
};
var depositMiner = rDM;

var rSB = {
    name: "spawnBuilder",
    type: "spawnBuilder",
    target: 0,

    /** @param {Creep} creep **/
    run: function(creep) {
        // Use the spawn queue to set respawn
        if(creep.ticksToLive == 500 && Memory.flags.claim) {
            spawnQueue.respawn(creep);
        }

        if (Game.cpu.bucket < settings_1.bucket.colony) {
            return
        }

        var city = creep.memory.city;
        if(creep.memory.needBoost && !creep.memory.boosted){
            const boost = "XLH2O";
            libz.getBoosted(creep, boost);
            return
        }

        if (creep.hits < creep.hitsMax){
            motion.newMove(creep, Game.spawns[city].pos, 10);
            return
        }
        if (Memory.flags.claimRally && !creep.memory.rally){
            const flag = Memory.flags.claimRally;
            motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName));
            if (flag.x == creep.pos.x && flag.y == creep.pos.y && flag.roomName == creep.pos.roomName){
                creep.memory.rally = true;
            }
            return
        }
        if(!Memory.flags.claim){
            Game.spawns[creep.memory.city].memory[rSB.name] = 0;
            if(creep.memory.flagRoom){
                if(creep.pos.roomName != creep.memory.flagRoom){
                    motion.newMove(creep, new RoomPosition(24, 24, creep.memory.flagRoom), 23);
                    return
                }
                creep.memory.city = creep.memory.flagRoom + "0";
                const room = Game.rooms[creep.memory.flagRoom];
                const minerCount = _.filter(room.find(FIND_MY_CREEPS), c => c.memory.role == "remoteMiner").length;
                if(minerCount < 2){
                    creep.memory.role = "remoteMiner";
                    return
                }
                creep.memory.role = libz.name;
            }
            return
        }
        if(!creep.memory.flagRoom){
            creep.memory.flagRoom = Memory.flags.claim.roomName;
        }
        if(Game.time % 100 == 0){
            if(!Memory.flags.claim.startTime){
                Memory.flags.claim.startTime = Game.time;
            }
            if(Memory.flags.claim.startTime < Game.time - 10000){
                if(Cache.roomData && Cache.roomData[Memory.flags.claim.roomName]){
                    Cache.roomData[Memory.flags.claim.roomName].claimBlock = Game.time + 150000;
                }
                utils.removeFlags(Memory.flags.claim.roomName);
                return
            }
        }
        if(creep.pos.roomName === Memory.flags.claim.roomName){
            if (!creep.room.controller || !creep.room.controller.my) {
                breaker.breakStuff(creep, null);
                motion.newMove(creep, creep.room.controller.pos, 3);
                return
            }
            if(Game.time % 100 == 0 && rSB.jobDone(creep)){
                utils.removeFlags(Memory.flags.claim.roomName);
            }
            if(creep.store.energy == 0 && creep.memory.building){
                creep.memory.building = false;
            }
            if(creep.store.energy == creep.store.getCapacity() && !creep.memory.building) {
                creep.memory.building = true;
            }
            if (creep.memory.building){
                rSB.build(creep);
            } else {
                rSB.harvest(creep);
            }
        } else {
            const flag = Memory.flags.claim;
            motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), 5);
        }
    },

    jobDone: function(creep) {
        const extensions = _.filter(creep.room.find(FIND_MY_STRUCTURES), structure => structure.structureType == STRUCTURE_EXTENSION);
        const cSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        return (extensions.length > 4 && !cSites.length)
    },
    
    build: function(creep) {
        if(creep.room.controller && creep.room.controller.level < 2 
            || creep.room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[creep.room.controller.level] - 5000
            || (creep.room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[creep.room.controller.level] - 1000 && creep.pos.inRangeTo(creep.room.controller.pos, 3))){
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                motion.newMove(creep, creep.room.controller.pos, 3);
            }
            return
        }
        var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        var spawn = _.find(targets, site => site.structureType == STRUCTURE_SPAWN);
        var extensions = _.find(targets, site => site.structureType == STRUCTURE_EXTENSION);
        var storage = _.find(targets, site => site.structureType == STRUCTURE_STORAGE);
        var terminal = _.find(targets, site => site.structureType == STRUCTURE_TERMINAL);
        var tower = _.find(targets, site => site.structureType == STRUCTURE_TOWER);
        if(targets.length) {
            var target = targets[0];
            if (terminal){
                target = terminal;
            } else if (spawn){
                target = spawn;
            } else if (extensions){
                target = extensions;
            } else if (storage){
                target = storage;
            } else if(tower){
                target = tower;
            }
            if(creep.build(target) == ERR_NOT_IN_RANGE) {
                motion.newMove(creep, target.pos, 3);
            }
        } else {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                motion.newMove(creep, creep.room.controller.pos, 3);
            }
        }  
    },
    
    harvest: function(creep) {
        const terminal = creep.room.terminal;
        if(terminal && terminal.store[RESOURCE_ENERGY] >= creep.store.getCapacity()){
            actions_1.withdraw(creep, terminal, RESOURCE_ENERGY);
            return
        }
        const dropped = _.find(creep.room.find(FIND_DROPPED_RESOURCES), r => r.resourceType == RESOURCE_ENERGY && r.amount > 50);
        if(dropped){
            actions_1.pick(creep, dropped);
            return
        }
        var sources =  creep.room.find(FIND_SOURCES);
        if (sources.length == 1){
            const result = creep.harvest(sources[0]);
            if(result == ERR_NOT_IN_RANGE) {
                motion.newMove(creep, sources[0].pos, 1);
            }
            return
        }
        const result = creep.harvest(sources[creep.memory.target]);
        if(result == ERR_NOT_IN_RANGE) {
            if(creep.moveTo(sources[creep.memory.target], {reusePath: 15, range: 1}) == ERR_NO_PATH){
                creep.memory.target = (creep.memory.target + 1) % 2;
            }
        } else if (result == ERR_NOT_ENOUGH_RESOURCES){
            creep.memory.target = (creep.memory.target + 1) % 2;
        }
    }
};
var spawnBuilder = rSB;

var rC = {
    name: "claimer",
    type: "claimer",

    /** @param {Creep} creep **/
    run: function(creep) {
        return rC.claimRally(creep, Memory.flags.claimRally) ||
                rC.runClaimer(creep, Memory.flags.claim, rC.claim)
    },

    claimRally: function(creep, flag) {
        if (!flag || creep.memory.rally) {
            return false
        }

        motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName));
        if (flag.x == creep.pos.x && flag.y == creep.pos.y) {
            creep.memory.rally = true;
        }
        return true
    },

    runClaimer: function(creep, flag, actionFn) {
        if (!flag) {
            return false
        }

        if (flag.roomName != creep.pos.roomName) {
            motion.newMove(creep, new RoomPosition(flag.x, flag.y, flag.roomName), 5);
        } else if (!creep.pos.isNearTo(creep.room.controller.pos)) {
            motion.newMove(creep, creep.room.controller.pos, 1);
        } else { 
            actionFn(creep);
        }
        return true
    },

    claim: function(creep) {
        var newCity = creep.room.name + "0";
        creep.signController(creep.room.controller, newCity);
        creep.room.memory.city = newCity;
        if(creep.claimController(creep.room.controller) == ERR_INVALID_TARGET && !creep.room.controller.my){
            creep.attackController(creep.room.controller);
        }
    }    
};
var claimer = rC;

var rUC = {
    name: "unclaimer",
    type: "unclaimer",

    /** @param {Creep} creep **/
    run: function(creep) {
        return claimer.claimRally(creep, Memory.flags.unclaimRally) || 
                claimer.runClaimer(creep, Memory.flags.unclaim, rUC.unclaim)
    },

    unclaim: function(creep) {
        const result = creep.attackController(creep.room.controller);
        if(!creep.room.controller.level){
            delete Memory.flags.unclaim;
        }
        if(result === OK){
            Game.spawns[creep.memory.city].memory[rUC.name] = 0;
            creep.suicide();
        }
    }    
};
var unclaimer = rUC;

var rF = {
    name: "ferry",
    type: "ferry",
    target: 0,
    TERMINAL_MAX_MINERAL_AMOUNT: 9000,
    FERRY_CARRY_AMOUNT: 1000,

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.ticksToLive < 10 && creep.store.getUsedCapacity() == 0){
            creep.suicide();
            return
        }
        if(creep.ticksToLive == creep.body.length * CREEP_SPAWN_TIME){
            spawnQueue.respawn(creep);
        }
        if (creep.saying == "getJob"){
            creep.memory.target = rF.getJob(creep);
        }
        const refreshTime = Memory.avgCpu < 0.7 * Game.cpu.limit ? 2 : 10;
        const link = Game.getObjectById(Game.spawns[creep.memory.city].memory.storageLink);
        switch(creep.memory.target){
        case 0:
            //no jobs available
            //Log.info('hi')
            if (Game.time % refreshTime === 0){
                creep.say("getJob");
            }
            break
        case 1:
            //move energy from storage to terminal
            if (creep.store.energy > 0){
                actions_1.charge(creep, creep.room.terminal);
            } else if(creep.room.storage.store.energy > 150000 && creep.room.terminal.store.energy < 50000){
                if (Game.time % 10 === 0 || Game.time % 10 === 1){
                    creep.memory.target = rF.getJob(creep);
                    break
                }
                actions_1.withdraw(creep, creep.room.storage, RESOURCE_ENERGY);
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        case 2:
            //move minerals from storage to terminal
            if (_.sum(creep.store) > 0){
                actions_1.charge(creep, creep.room.terminal);
                break
            }
            if(creep.room.storage.store[creep.memory.mineral] > 0 
                && creep.room.terminal.store[creep.memory.mineral] < rF.TERMINAL_MAX_MINERAL_AMOUNT - rF.FERRY_CARRY_AMOUNT
                && _.sum(creep.room.terminal.store) < 295000){
                actions_1.withdraw(creep, creep.room.storage, creep.memory.mineral);
            } else {
                creep.say("getJob");
            }
            break
        case 3:
            //move energy from terminal to storage
            if (creep.store.energy > 0){
                actions_1.charge(creep, creep.room.storage);
            } else if(creep.room.terminal.store.energy > 51000){
                actions_1.withdraw(creep, creep.room.terminal, RESOURCE_ENERGY);
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        case 4: {
            //move power from terminal to power spawn
            const powerSpawn = _.find(creep.room.find(FIND_MY_STRUCTURES), (structure) => structure.structureType == STRUCTURE_POWER_SPAWN);
            if ((creep.store.power) > 0){
                actions_1.charge(creep, powerSpawn);
                //creep.transfer(powerSpawn, 'power')
            } else if(powerSpawn.power < 30 && creep.room.terminal.store.power){
                actions_1.withdraw(creep, creep.room.terminal, RESOURCE_POWER, Math.min(70, creep.room.terminal.store[RESOURCE_POWER]));
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        } 
        case 5:
            //move energy from storage link to storage
            if (creep.store.energy > 0){
                actions_1.charge(creep, creep.room.storage);
            } else if (link.energy > 0){
                actions_1.withdraw(creep, link, RESOURCE_ENERGY);
            } else {
                creep.say("getJob");
            }
            break
        case 6:
            //move mineral from terminal to storage
            if (_.sum(creep.store) > 0){
                actions_1.charge(creep, creep.room.storage);
                break
            }
            if(creep.room.terminal.store[creep.memory.mineral] > rF.TERMINAL_MAX_MINERAL_AMOUNT){
                actions_1.withdraw(creep, creep.room.terminal, creep.memory.mineral);
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        case 7: {
            //move mineral from lab to terminal
            
            break
        }  
        case 8:
            //load up the nuker
            if (_.sum(creep.store) > 0){
                const nuker = Game.getObjectById(creep.memory.nuker);
                const result = actions_1.charge(creep, nuker);
                if(result == 1){
                    creep.say("getJob");
                }
                break
            }
            if (creep.room.terminal.store["G"] >= 4000){
                actions_1.withdraw(creep, creep.room.terminal, RESOURCE_GHODIUM);
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        case 9:{
            //move mineral from terminal to booster
            const lab = Game.getObjectById(creep.memory.lab);
            if (_.sum(creep.store) > 0){
                const result = actions_1.charge(creep, lab);
                if(result == 1){
                    if(creep.memory.reactor){
                        Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.reactors[creep.memory.lab].fill--;
                    } else {
                        Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers[creep.memory.lab].fill--;
                    }
                    creep.say("getJob");
                }
                break
            }
            const amountNeeded = Math.min(lab.store.getFreeCapacity(creep.memory.mineral), creep.store.getFreeCapacity());
            if(amountNeeded === 0 && creep.memory.reactor){
                //lab has incorrect mineral
                //clear both reactors to reset lab process
                rF.clearReactors(Game.spawns[creep.memory.city].memory);
                creep.memory.target = rF.getJob(creep);
                break
            }
            if (creep.room.terminal.store[creep.memory.mineral] >= amountNeeded){
                actions_1.withdraw(creep, creep.room.terminal, creep.memory.mineral, amountNeeded);
            } else {
                creep.memory.target = rF.getJob(creep);
            }
            break
        }
        case 10: {
            //move mineral from booster to terminal
            if (_.sum(creep.store) > 0){
                const result = actions_1.charge(creep, creep.room.terminal);
                if (result == 1){
                    creep.say("getJob");
                    break
                }
                break
            }
            const lab = Game.getObjectById(creep.memory.lab);
            if(!lab.mineralType || actions_1.withdraw(creep, lab, lab.mineralType) == 1 && lab.store[lab.mineralType] <= 1000){
                const labInfo = Game.spawns[creep.memory.city].memory.ferryInfo.labInfo;
                if(creep.memory.reactor && labInfo.reactors[creep.memory.lab].fill == -1){
                    labInfo.reactors[creep.memory.lab].fill = 0;
                } else if (labInfo.receivers[creep.memory.lab].fill == -1){
                    Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers[creep.memory.lab].fill = 0;
                }
            }
            if(!lab.mineralType){
                creep.memory.target = rF.getJob(creep);
            }
            break
        }
        case 11: {
            //move produce from factory to terminal
            if (_.sum(creep.store) > 0){
                const result = actions_1.charge(creep, creep.room.terminal);
                if(result == 1){//successful deposit, remove element from task list
                    _.pullAt(Game.spawns[creep.memory.city].memory.ferryInfo.factoryInfo.transfer, creep.memory.labNum); //remove element
                    creep.say("getJob");
                }
                break
            }
            const factory = Game.getObjectById(creep.memory.lab);
            actions_1.withdraw(creep, factory, creep.memory.mineral, Math.min(creep.memory.quantity, creep.store.getCapacity())); 

            break
        }
        case 12:
            //move component from terminal to factory
            if (_.sum(creep.store) > 0){
                const factory = Game.getObjectById(creep.memory.lab);
                const result = creep.transfer(factory, creep.memory.mineral, creep.memory.quantity);
                if (result == 0){
                    _.pullAt(Game.spawns[creep.memory.city].memory.ferryInfo.factoryInfo.transfer, creep.memory.labNum); //remove element
                    creep.say("getJob");
                    break
                }
                creep.moveTo(factory);
                break
            }
            actions_1.withdraw(creep, creep.room.terminal, creep.memory.mineral, creep.memory.quantity);
            break
        case 13:
            // move energy from storage to link
            if (creep.store.energy === 0 && link.energy === 0){//both are empty
                actions_1.withdraw(creep, creep.room.storage, RESOURCE_ENERGY, LINK_CAPACITY);
            } else if (link.energy === 0){//link is empty and creep has energy
                actions_1.charge(creep, link);
            } else if(creep.store.energy > 0){//link has energy and creep has energy
                creep.memory.target = 5;//switch to depositing energy in storage
            } else {//job done: link has energy and creep is empty
                creep.say("getJob");
            }
            break 
        }
    },
    
    getJob: function(creep){
        if (creep.ticksToLive < 50){
            creep.suicide();
            return 0
        }
        const link = Game.getObjectById(Game.spawns[creep.memory.city].memory.storageLink);
        let upgradeLink = null;
        if(Cache[creep.room.name]){
            const links = Cache[creep.room.name].links || {};
            upgradeLink = Game.getObjectById(links.upgrade);
        }
        if (link && !link.store.energy && upgradeLink && !upgradeLink.store.energy) {
            return 13
        } else if (link && link.store.energy > 0 && !link.cooldown) {
            return 5
        }
        if(!creep.room.terminal){
            return 0
        }
        const storage = creep.room.storage;
        if (storage && storage.store.energy > 150000 && creep.room.terminal.store.energy < 50000 && _.sum(creep.room.terminal.store) < 295000){
            return 1
        }
        if (creep.room.terminal.store.energy > 51000){
            return 3
        }
        if (Game.spawns[creep.memory.city].memory.ferryInfo.needPower === true && Game.spawns[creep.memory.city].room.terminal.store[RESOURCE_POWER] > 0){
            return 4
        }
        if(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo 
            && Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.reactors 
            && Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers){
            const reactors = Object.keys(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.reactors);
            const reactorInfo = Object.values(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.reactors);
            for(let i = 0; i < reactors.length; i++){
                if(!reactorInfo[i].fill){
                    continue
                }
                if(reactorInfo[i].fill == -1){
                    //empty reactor
                    creep.memory.lab = reactors[i];
                    creep.memory.reactor = true;
                    return 10
                }
                if(reactorInfo[i].fill > 0 && creep.room.terminal.store[reactorInfo[i].mineral] >= 1000){
                    //fill reactor
                    creep.memory.lab = reactors[i];
                    creep.memory.reactor = true;
                    creep.memory.mineral = reactorInfo[i].mineral;
                    return 9
                }
            }
            const receivers = Object.keys(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers);
            const receiverInfo = Object.values(Game.spawns[creep.memory.city].memory.ferryInfo.labInfo.receivers);
            for(let i = 0; i < receivers.length; i++){
                if(!receiverInfo[i].fill){
                    continue
                }
                if(receiverInfo[i].fill == -1){
                    //empty receiver
                    creep.memory.lab = receivers[i];
                    creep.memory.reactor = false;
                    return 10
                }
                if(receiverInfo[i].fill > 0 && creep.room.terminal.store[receiverInfo[i].boost] >= 1000){
                    //fill receiver
                    const lab = Game.getObjectById(receivers[i]);
                    creep.memory.lab = receivers[i];
                    creep.memory.reactor = false;
                    if(lab.mineralType && lab.mineralType != receiverInfo[i].boost){

                        return 10
                    }
                    creep.memory.mineral = receiverInfo[i].boost;
                    return 9
                } else if(receiverInfo[i].fill > 0 && creep.room.terminal.store[receiverInfo[i].boost] < 1000
                    && !Game.spawns[creep.memory.city].memory.ferryInfo.mineralRequest){
                    Game.spawns[creep.memory.city].memory.ferryInfo.mineralRequest = receiverInfo[i].boost;
                }
            }
        }
        if(storage && Object.keys(storage.store).length > 1){
            for(const mineral of Object.keys(storage.store)){
                if(creep.room.terminal.store[mineral] < rF.TERMINAL_MAX_MINERAL_AMOUNT - rF.FERRY_CARRY_AMOUNT){
                    creep.memory.mineral = mineral;
                    return 2
                }
            }
        }
        if(storage){
            for(const mineral of Object.keys(creep.room.terminal.store)){
                if(creep.room.terminal.store[mineral] > rF.TERMINAL_MAX_MINERAL_AMOUNT && mineral != RESOURCE_ENERGY){
                    creep.memory.mineral = mineral;
                    return 6 
                }
            }
        }
        if(Game.spawns[creep.memory.city].memory.ferryInfo.factoryInfo){
            const transfer = Game.spawns[creep.memory.city].memory.ferryInfo.factoryInfo.transfer;
            if(transfer.length){
                for(let i = 0; i < transfer.length; i++){
                    if(transfer[i][1] === 0){//move produce from factory to terminal
                        creep.memory.mineral = transfer[i][0];
                        creep.memory.quantity = transfer[i][2];
                        creep.memory.labNum = i; //use labNum as index
                        creep.memory.lab = _.find(creep.room.find(FIND_MY_STRUCTURES), structure => structure.structureType == STRUCTURE_FACTORY).id;
                        return 11
                    }
                    if(transfer[i][1] === 1){//move component from terminal to factory OR request mineral if no mineral request
                        //if compenent that is needed is not in terminal, do not request, component will be delivered by empire manager
                        if(creep.room.terminal.store[transfer[i][0]] >= transfer[i][2]){ 
                            creep.memory.mineral = transfer[i][0];
                            creep.memory.quantity = transfer[i][2];
                            creep.memory.labNum = i;
                            creep.memory.lab = _.find(creep.room.find(FIND_MY_STRUCTURES), structure => structure.structureType == STRUCTURE_FACTORY).id;
                            return 12
                        }
                        if(_.includes(Object.keys(REACTIONS), transfer[i][0])){// must be a mineral of some sort
                            if(!Game.spawns[creep.memory.city].memory.ferryInfo.mineralRequest){
                                Game.spawns[creep.memory.city].memory.ferryInfo.mineralRequest = transfer[i][0];
                            }
                        }
                    }

                }
            }
        }
        const nuker = _.find(creep.room.find(FIND_MY_STRUCTURES), structure => structure.structureType == STRUCTURE_NUKER);
        if (nuker && nuker.ghodium < nuker.ghodiumCapacity && creep.room.terminal.store["G"] >= 4000){
            creep.memory.nuker = nuker.id;
            return 8
        }
        return 0
    },

    clearReactors: function(memory){
        const reactorInfo = Object.values(memory.ferryInfo.labInfo.reactors);
        for(const reactor of reactorInfo){
            reactor.fill = -1;
        }
    }
};
var ferry = rF;

var rMM = {
    name: "mineralMiner",
    type: "mineralMiner",

    /** @param {Creep} creep **/
    run: function(creep) {
        if(!creep.memory.suicideTime && creep.memory.source){
            const works = creep.getActiveBodyparts(WORK) * HARVEST_MINERAL_POWER;
            const carry = creep.getActiveBodyparts(CARRY) * CARRY_CAPACITY;
            const ticksToFill = Math.ceil(carry/works * EXTRACTOR_COOLDOWN);
            const mineral = Game.getObjectById(creep.memory.source);
            const distance = Game.spawns[creep.memory.city].pos.getRangeTo(mineral.pos);
            creep.memory.suicideTime = distance + ticksToFill;
        }
        if (_.sum(creep.store) == 0 && creep.ticksToLive < creep.memory.suicideTime){
            creep.suicide();
        }
        if (!creep.memory.source){
            var sources = creep.room.find(FIND_MINERALS);
            creep.memory.source = sources[0].id;
        }
        if (rMM.needEnergy(creep)){
            rMM.harvestTarget(creep);
        } else {
            var bucket = utils.getStorage(creep.room);
            actions_1.charge(creep, bucket);
        }
    },

    needEnergy: function(creep) {
        const store = _.sum(creep.store);
        return (store < creep.store.getCapacity())
    },

    harvestTarget: function(creep) {
        var source = Game.getObjectById(creep.memory.source);
        const harvestResult = actions_1.harvest(creep, source);
        if (harvestResult == ERR_NO_PATH) {
            Log.info("no path for mining :/");
        } else if (harvestResult == 1) {
        // Record mining totals in memory for stat tracking
            const works = _.filter(creep.body, part => part.type == WORK).length;
            if (!creep.memory.mined) {
                creep.memory.mined = 0;
            }
            creep.memory.mined += works;
        }
    },


};
var mineralMiner = rMM;

var rT = {
    name: "transporter",
    type: "transporter",

    /** @param {Creep} creep **/
    run: function(creep) {
        if(rT.endLife(creep)){
            return
        }
        var city = creep.memory.city;
        if (creep.saying > 0 && creep.room.energyAvailable == creep.room.energyCapacityAvailable){
            creep.say(creep.saying - 1);
            return
        }
        if (creep.store.energy == 0) {
            //refill on energy
            if(rT.refill(creep, city) === 1){
                //start moving to target
                const target = rT.findTarget(creep, null);
                rT.moveToTargetIfPresent(creep, target);
            }
        } else {
            const target = rT.findTarget(creep, null);

            if(!target){
                creep.say(30);
                return
            }

            const result = actions_1.charge(creep, target, false);
            if(result === 1 || !rT.needsEnergy(target)){//successful deposit
                const extra = creep.store[RESOURCE_ENERGY] - target.store.getFreeCapacity(RESOURCE_ENERGY);
                
                if (extra >= 0 || target.store.getUsedCapacity(RESOURCE_ENERGY) >= 10000) {
                    //make sure to remove current target from search list
                    const newTarget = rT.findTarget(creep, target); 
                    //if creep still has energy, start moving to next target
                    if (extra > 0) {
                        rT.moveToTargetIfPresent(creep, newTarget);
                    } else {
                        //start moving to storage already
                        rT.refill(creep, city);
                    }
                }
            }
        }
    },

    moveToTargetIfPresent: function(creep, target) {
        if(!target){
            creep.say(0);
            return
        }
        //start moving to next target if target not already in range
        if(!target.pos.isNearTo(creep.pos)){
            const boundingBox = motion.getBoundingBox(creep.room);
            motion.newMove(creep, target.pos, 1, true, boundingBox);
        }
    },
 
    findTarget: function(creep, oldTarget){
        const ccache = utils.getCreepCache(creep.id);
        if (ccache.target && !oldTarget) {
            const cachedTarget = Game.getObjectById(ccache.target);
            if (rT.needsEnergy(cachedTarget)) {
                return cachedTarget
            }
        }

        const targets = _(rT.getTargets(creep, oldTarget))
            .map(Game.getObjectById)
            .value();

        ccache.target = creep.pos.findClosestByRange(targets);
        return ccache.target
    },

    getTargets: function(creep, oldTarget) {
        const rcache = utils.getRoomCache(creep.room.name);
        const refillTargets = utils.getsetd(rcache, "refillTargets", []);
        const unused = _(refillTargets)
            .filter(id => !oldTarget || id != oldTarget.id)
            .value();

        if (unused.length && !rT.missingTargets(unused, creep.room)) {
            rcache.refillTargets = unused;
        } else {
            rcache.refillTargets = rT.emptyTargets(creep.room);
        }
        return rcache.refillTargets
    },

    missingTargets: function(cachedTargets, room) {
        const rcl = room.controller.level;
        const missingEnergy = room.energyCapacityAvailable - room.energyAvailable;
        const cachedTargetsEnergy = cachedTargets.length * EXTENSION_ENERGY_CAPACITY[rcl];
        return missingEnergy - cachedTargetsEnergy > 1000
    },

    emptyTargets: function(room) {
        return _(room.find(FIND_MY_STRUCTURES))
            .filter(rT.needsEnergy)
            .map("id")
            .value()
    },

    needsEnergy: function(structure){
        if(!structure){
            return false
        }
        const store = structure.store;
        switch(structure.structureType){
        case STRUCTURE_EXTENSION:
        case STRUCTURE_SPAWN:
        case STRUCTURE_LAB:
        case STRUCTURE_NUKER:
            //if there is any room for energy, needs energy
            return (store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        case STRUCTURE_TOWER:
        case STRUCTURE_POWER_SPAWN:
            //arbitrary buffer
            return (store.getFreeCapacity(RESOURCE_ENERGY) > 400)
        case STRUCTURE_FACTORY:
            //arbitrary max value
            return (store.getUsedCapacity(RESOURCE_ENERGY) < 10000)
        default:
            return false
        }
    },

    endLife: function(creep){
        if(creep.ticksToLive == 200){
            const transporters = _.filter(creep.room.find(FIND_MY_CREEPS), c => c.memory.role == "transporter");
            if(transporters.length < 2){
                spawnQueue.respawn(creep);
            }
        }
        if(creep.ticksToLive > 10 || !creep.room.storage){
            return false
        }
        if(creep.store.getUsedCapacity() > 0){
            actions_1.charge(creep, creep.room.storage);
        } else {
            creep.suicide();
        }
        return true
    },

    refill: function(creep){
        let result = 0;
        if (Game.getObjectById(creep.memory.location)) {
            var bucket = Game.getObjectById(creep.memory.location);
            if(creep.store.getUsedCapacity() > 0){
                if(!creep.pos.isNearTo(bucket.pos)){
                    motion.newMove(creep, bucket.pos, 1);
                }
                return result
            }
            result = actions_1.withdraw(creep, bucket);
            if (result == ERR_NOT_ENOUGH_RESOURCES || bucket.structureType == STRUCTURE_SPAWN){
                creep.memory.location = utils.getStorage(creep.room).id;
            }
        } else {
            const location = utils.getStorage(creep.room);
            creep.memory.location = location.id;
            if(creep.store.getUsedCapacity() > 0){
                if(!creep.pos.isNearTo(location.pos)){
                    motion.newMove(creep, location.pos, 1);
                }
                return result
            }
            result = actions_1.withdraw(creep, location);
        }
        return result
    }
};
var transporter = rT;

var rM = {
    name: "remoteMiner",
    type: "miner",

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.spawning){
            return
        }
        if(creep.ticksToLive == creep.memory.spawnBuffer + (creep.body.length * CREEP_SPAWN_TIME) && Game.spawns[creep.memory.city].memory.remoteMiner > 0) {
            spawnQueue.respawn(creep);
        }
        if(creep.hits < creep.hitsMax && creep.pos.roomName == Game.spawns[creep.memory.city].pos.roomName){
            Game.spawns[creep.memory.city].memory.towersActive = true;
            motion.newMove(creep, Game.spawns[creep.memory.city].pos, 7);
            return
        }
        if(!creep.memory.source) {
            rM.nextSource(creep);
            return
        }
        const source = Game.getObjectById(creep.memory.source);
        rM.setMoveStatus(creep);
        rM.maybeMove(creep, source);
        if(!source)
            return
        if(creep.memory.construction && rM.build(creep, source))
            return
        if(creep.memory.link){
            const link = Game.getObjectById(creep.memory.link);
            if(link){
                if(source.energy > 0 && creep.store.getFreeCapacity() > 0)
                    creep.harvest(source);
                if(!creep.store.getFreeCapacity())
                    actions_1.charge(creep, link);
                return
            } else {
                creep.memory.link = null;
            }
        } else if(creep.memory.container){
            const container = Game.getObjectById(creep.memory.container);
            if(container){
                if(container.hits < container.hitsMax * 0.3 && creep.store.getUsedCapacity() > 0 && !creep.store.getFreeCapacity()){
                    creep.repair(container);
                } else if(source.energy > 0 && (container.store.getFreeCapacity() > 0 || creep.store.getFreeCapacity() > 0)){
                    creep.harvest(source);
                } else if (container.hits < container.hitsMax * 0.9 && creep.store.getUsedCapacity() > 0){
                    creep.repair(container);
                }
            } else {
                creep.memory.container = null;
            }
        } else if(source.energy > 0){
            creep.harvest(source);
        }
        if(Game.time % settings_1.minerUpdateTime == 0){
            if(creep.pos.isNearTo(source.pos) && !creep.memory.spawnBuffer){
                creep.memory.spawnBuffer = PathFinder.search(Game.spawns[creep.memory.city].pos, source.pos).cost;
            }
            //update container/link status
            //if we have a link no need to search
            if(creep.memory.link && Game.getObjectById(creep.memory.link))
                return
            //get Destination assigns structures/sites anyway so might as well reuse
            rM.getDestination(creep, source);
            if(!creep.memory.link && !creep.memory.container && !creep.memory.construction && creep.body.length > 5)
                rM.placeContainer(creep, source);
        }
    },

    placeContainer: function(creep, source){
        const spawn = Game.spawns[creep.memory.city];
        if(spawn.memory.sources[source.id][STRUCTURE_CONTAINER + "Pos"]){
            const pos = spawn.memory.sources[source.id][STRUCTURE_CONTAINER + "Pos"];
            source.room.createConstructionSite(Math.floor(pos/50), pos%50, STRUCTURE_CONTAINER);
            return
        }
        if(creep.memory.miningPos || creep.memory.destination){
            const pos = creep.memory.miningPos || creep.memory.destination;
            if(creep.pos.isEqualTo(new RoomPosition(pos.x, pos.y, pos.roomName))){
                spawn.memory.sources[source.id][STRUCTURE_CONTAINER + "Pos"] = creep.pos.x * 50 + creep.pos.y;
                creep.pos.createConstructionSite(STRUCTURE_CONTAINER);
            }
        }
    },

    build: function (creep, source){
        const cSite = Game.getObjectById(creep.memory.construction);
        if(!cSite){
            creep.memory.construction = null;
            return false
        }
        if(creep.store.getUsedCapacity() > creep.store.getCapacity()/2){
            creep.build(cSite);
        } else {
            creep.harvest(source);
        }
        return true
    },

    maybeMove: function(creep, source){
        if(creep.memory.moveStatus == "static"){
            if(!source){
                creep.memory.destination = creep.memory.sourcePos;
                return
            }
            if(!creep.memory.destination 
                || new RoomPosition(creep.memory.destination.x, creep.memory.destination.y, creep.memory.destination.roomName).isEqualTo(creep.memory.sourcePos.x, creep.memory.sourcePos.y))
                creep.memory.destination = rM.getDestination(creep, source);
            return
        }
        if(!source){
            motion.newMove(creep, new RoomPosition(creep.memory.sourcePos.x, creep.memory.sourcePos.y, creep.memory.sourcePos.roomName), 1);
            return
        }
        if(!creep.memory.miningPos){
            creep.memory.miningPos = rM.getDestination(creep, source);
            if(!creep.memory.miningPos)
                return
        }
        const miningPos = new RoomPosition(creep.memory.miningPos.x, creep.memory.miningPos.y, creep.memory.miningPos.roomName);
        if(!creep.pos.isEqualTo(miningPos))
            motion.newMove(creep, miningPos);
    },

    getLinkMiningPos: function(link, source){
        for(let i = link.pos.x - 1; i <= link.pos.x + 1; i++){
            for(let j = link.pos.y - 1; j <= link.pos.y + 1; j++){
                const testPos = new RoomPosition(i, j, link.pos.roomName);
                if(testPos.isNearTo(source) && !rM.isPositionBlocked(testPos))
                    return testPos
            }
        }
        return null
    },

    getDestination: function(creep, source) {
        //look for links
        const link = rM.findStruct(creep, source, STRUCTURE_LINK);
        if(link){
            creep.memory.link = link.id;
            return rM.getLinkMiningPos(link, source)
        }
        const linkSite = rM.findStruct(creep, source, STRUCTURE_LINK, true);
        if(linkSite){
            creep.memory.construction = linkSite.id;
            return rM.getLinkMiningPos(linkSite, source)
        }
        //look for containers
        const container = rM.findStruct(creep, source, STRUCTURE_CONTAINER);
        if(container){
            creep.memory.container = container.id;
            return container.pos
        }
        const containerSite = rM.findStruct(creep, source, STRUCTURE_CONTAINER, true);
        if(containerSite){
            creep.memory.construction = containerSite.id;
            return containerSite.pos
        }
        //look for empty space to mine
        for(let i = source.pos.x - 1; i <= source.pos.x + 1; i++){
            for(let j = source.pos.y - 1;j <= source.pos.y + 1; j++){
                if(!rM.isPositionBlocked(new RoomPosition(i, j, source.pos.roomName)))
                    return new RoomPosition(i, j, source.pos.roomName)
            }
        }
    },

    findStruct: function(creep, source, structureType, construction = false){
        const type = construction ? LOOK_CONSTRUCTION_SITES : LOOK_STRUCTURES;
        const memory = Game.spawns[creep.memory.city].memory;
        const structPos = memory.sources[source.id][structureType + "Pos"];
        if(structPos){
            const realPos = new RoomPosition(Math.floor(structPos/50), structPos%50, source.pos.roomName);
            const look = realPos.lookFor(type);
            const structure = _.find(look, struct => struct.structureType == structureType && (!struct.owner || struct.my));
            if(structure)
                return structure
        }
        return null
    },

    isPositionBlocked: function(roomPos){
        const look = roomPos.look();
        for(const lookObject of look){
            if((lookObject.type == LOOK_TERRAIN 
                && lookObject[LOOK_TERRAIN] == "wall")//no constant for wall atm
                || (lookObject.type == LOOK_STRUCTURES
                && OBSTACLE_OBJECT_TYPES[lookObject[LOOK_STRUCTURES].structureType])) {
                return true
            }
        }
        return false
    },

    setMoveStatus: function(creep) {
        if(!creep.memory.moveStatus)
            creep.memory.moveStatus = creep.getActiveBodyparts(MOVE) ? "mobile" : "static";
    },

    canCarry: function(creep){
        return creep.getActiveBodyparts(CARRY) > 0
    },

    harvestTarget: function(creep) {
        var source = Game.getObjectById(creep.memory.source);
        if(!creep.pos.inRangeTo(source, 2)){
            motion.newMove(creep, source.pos, 2);
            return
        }
        if (creep.body.length === 15 && creep.pos.isNearTo(source) && Game.time % 2 === 0) {
            return
        }

        if(actions_1.harvest(creep, source) === 1 && !creep.memory.spawnBuffer){
            creep.memory.spawnBuffer = PathFinder.search(Game.spawns[creep.memory.city].pos, source.pos).cost;
        }
    },

    /** pick a target id for creep **/
    nextSource: function(creep) {
        var city = creep.memory.city;
        var miners = _.filter(utils.splitCreepsByCity()[city], c => c.memory.role === rM.name 
            && c.ticksToLive > (c.memory.spawnBuffer || 50));
        var occupied = [];
        _.each(miners, function(minerInfo){
            occupied.push(minerInfo.memory.source);
        });
        const sourceMap = Game.spawns[city].memory.sources || {};
        var sources = Object.keys(sourceMap);
        var openSources = _.filter(sources, Id => !occupied.includes(Id));
        
        if (openSources.length){
            creep.memory.source = openSources[0];
            creep.memory.sourcePos = Game.spawns[city].memory.sources[openSources[0]];
        }
    }
};
var remoteMiner = rM;

var rRo = {
    name: "robber",
    type: "robber",

    /** @param {Creep} creep **/
    run: function(creep) {
        const flagName = "steal";
        const flag = Memory.flags[flagName];

        if (creep.store.getUsedCapacity() == 0) {
            if(!flag){
                creep.suicide();
                return
            }
            if(creep.memory.flagDistance && creep.ticksToLive <= creep.memory.flagDistance){
                creep.suicide();
                spawnQueue.respawn(creep);
                return
            }
            //if creep can't complete round trip suicide and respawn
        }
        if(!creep.store.getUsedCapacity() || ((creep.pos.roomName != Game.spawns[creep.memory.city].pos.roomName && creep.store.getFreeCapacity()) && flag)){
            //pick up more stuff
            const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);
            if(!creep.memory.flagDistance){
                creep.memory.flagDistance = motion.getRoute(Game.spawns[creep.memory.city].pos.roomName, flag.roomName, true).length * 50;
            }
            if(Game.rooms[flag.roomName]){
                if(creep.memory.target){
                    const target = Game.getObjectById(creep.memory.target);
                    if(!target.store[creep.memory.resource]){
                        creep.memory.target = null;
                        creep.memory.resource = null;
                    }
                }
                if(!creep.memory.target){
                    const structs = _.filter(flagPos.lookFor(LOOK_STRUCTURES).concat(flagPos.lookFor(LOOK_RUINS)), s => s.store);
                    for(const struct of structs){
                        const valuables = _.filter(Object.keys(struct.store), k => k != RESOURCE_ENERGY);
                        if (valuables.length){
                            creep.memory.target = struct.id;
                            creep.memory.resource = valuables[0];
                            break
                        }
                    }
                }
                if(!creep.memory.target){
                    delete Memory.flags[flagName];
                } else {
                    actions_1.withdraw(creep, Game.getObjectById(creep.memory.target), creep.memory.resource);
                }
            } else {
                motion.newMove(creep, flagPos, 1);
            }
        } else {
            actions_1.charge(creep, Game.spawns[creep.memory.city].room.storage);
        }
    }  
};
var robber = rRo;

var rS = {
    name: "scout",
    type: "scout",
   
    run: function(creep) {
        const targetRoom = Memory.creeps[creep.name].targetRoom;
        if(!targetRoom || creep.room.name == targetRoom 
            || (Cache.roomData && Cache.roomData[targetRoom] && Cache.roomData[targetRoom].scoutTime > Game.time))
            rS.getNextTarget(creep);
        if(Memory.creeps[creep.name].targetRoom)
            motion.newMove(creep, new RoomPosition(25, 25, Memory.creeps[creep.name].targetRoom), 24);
    },

    getNextTarget: function(creep){
        const rcache = utils.getRoomCache(Game.spawns[creep.memory.city].pos.roomName);
        const targets = utils.getsetd(rcache, "scannerTargets", []);
        if(targets.length){
            Memory.creeps[creep.name].targetRoom = targets.shift();
            return
        }
        creep.suicide();
    }
};
var scout = rS;

const rQr = {
    name: "qrCode",
    type: "scout",
    target: 0,
   
    run: function(creep) {
        const flag = Memory.flags[creep.memory.flag];
        if(!flag)
            return
        const localCreeps = utils.splitCreepsByCity()[creep.memory.city];
        const qrs = _.filter(localCreeps, c => c.memory.role == rQr.name);
        if(creep.memory.row === undefined){
            let freeRow = null;
            for(let i = 0; i < template.qrCoords.length; i++){
                if(!_.find(qrs, c => c.memory.row == i && c.memory.target == 0)){
                    freeRow = i;
                    break
                }
            }
            if(freeRow === null){
                const targetPos = new RoomPosition(Math.max(flag.x - 2,0), Math.max(flag.x - 2,0), flag.roomName);
                if(!creep.pos.isEqualTo(targetPos))
                    motion.newMove(creep, targetPos);
                return
            }
            creep.memory.row = freeRow;
        }
        const row = creep.memory.row;
        while(creep.memory.target < template.qrCoords[row].length - 1 
            && !_.find(qrs, c => c.memory.row == row && c.memory.target == creep.memory.target + 1)){
            creep.memory.target++;
        }
        const target = template.qrCoords[row][creep.memory.target];
        const targetPos = new RoomPosition(target.x + flag.x, target.y + flag.y, flag.roomName);
        if(!creep.pos.isEqualTo(targetPos))
            motion.newMove(creep, targetPos);
    }
};
var qrCode = rQr;

var rr = {
    // order roles for priority. TODO powercreep?
    getRoles: function() {
        return [ferry, defender, transporter, remoteMiner, runner, libz, builder, quad, mineralMiner, claimer, unclaimer,
            spawnBuilder, libb,medic, breaker, powerMiner,
            robber, depositMiner, scout, qrCode]
    },

    getRolePriorities: function(){
        const priorites = {};
        priorites[ferry.name] = 0;
        priorites[defender.name] = 1;
        priorites[transporter.name] = 2;
        priorites[remoteMiner.name] = 3;
        priorites[runner.name] = 4;
        priorites[libz.name] = 5;
        priorites[builder.name] = 6;
        priorites[quad.name] = 7;
        priorites[mineralMiner.name] = 8;
        priorites[claimer.name] = 9;
        priorites[unclaimer.name] = 10;
        priorites[spawnBuilder.name] = 11;
        priorites[libb.name] = 12;
        priorites[medic.name] = 13;
        priorites[breaker.name] = 13;
        priorites[powerMiner.name] = 13;
        priorites[robber.name] = 14;
        priorites[depositMiner.name] = 15;
        priorites[scout.name] = 16;
        priorites[qrCode.name] = 17;
        return priorites
    },

    getCoreRoles: function() {
        return [ferry, defender, transporter, remoteMiner, runner, libz, builder]
    },

    getEmergencyRoles: function() {
        return [ferry, defender, transporter, remoteMiner, runner]
    }
};

var roles = rr;

function getRecipe(type, energyAvailable, room, boosted, flagName){
    const energy = energyAvailable || 0;
    const d = {};
    const rcl = room.controller.level;

    // used at all rcls
    d.scout = [MOVE];
    d.quad = quadBody(energy, rcl, room, boosted);
    d.runner = rcl == 1 ? scalingBody([1, 1], [CARRY, MOVE], energy) : scalingBody([2, 1], [CARRY, MOVE], energy);
    d.miner = minerBody(energy, rcl);
    d.normal = upgraderBody(energy, rcl, room);
    d.transporter = scalingBody([2, 1], [CARRY, MOVE], energy, 30);
    d.builder = builderBody(energy, rcl);
    d.defender = defenderBody(energy, rcl, boosted);
    d.unclaimer = scalingBody([2, 1], [MOVE, CLAIM], energy);
    d.harasser = harasserBody(energy, boosted, rcl);

    // used at rcl 4+
    d.spawnBuilder = scalingBody([2, 3, 5], [WORK, CARRY, MOVE], energy);
    d.trooper = scalingBody([1, 1], [RANGED_ATTACK, MOVE], energy);

    // used at rcl 5+
    d.ferry = scalingBody([2, 1], [CARRY, MOVE], energy, 30);
    d.breaker = breakerBody(energy, rcl, boosted);
    d.medic = medicBody(energy, rcl, boosted);

    // rcl 8 only
    d.powerMiner = pMinerBody(boosted);

    switch (rcl) {
    case 4:
        //lvl 4 recipes
        break
    case 5:
        //lvl 5 recipes
        d["robber"] = body([15, 15], [CARRY, MOVE]); 
        break
    case 6:
        // lvl 6 recipes
        d["mineralMiner"] = body([12, 6, 9], [WORK, CARRY, MOVE]);
        d["robber"] = body([20, 20], [CARRY, MOVE]);
        break
    case 7:
        // lvl 7 recipes
        d["mineralMiner"] = body([22, 10, 16], [WORK, CARRY, MOVE]);
        d["robber"] = body([25, 25], [CARRY, MOVE]);
        break
    case 8:
        // lvl 8 recipes
        d["mineralMiner"] = body([22, 10, 16], [WORK, CARRY, MOVE]);
        d["robber"] = body([25, 25], [CARRY, MOVE]);
        break
    }

    d.basic = body([1,1,1],[WORK, CARRY, MOVE]);
    d.lightMiner = body([2, 2], [MOVE, WORK]);
    d.erunner = body([2, 1], [CARRY, MOVE]);
    d.claimer = body([5, 1], [MOVE, CLAIM]);
    if (type === "depositMiner"){
        const dMinerCounts = dMinerCalc(room, boosted, flagName);
        d["depositMiner"] = body(dMinerCounts, [WORK, CARRY, MOVE]);
    }
    if (d[type] == null) {
        return [WORK, CARRY, MOVE]
    }
    return d[type]//recipe
}
function body(counts, order) { // order is list of types from move, work, attack, store, heal, ranged, tough, claim
    // assert counts.length == order.length
    const nestedPartsLists = _.map(counts, (count, index) => Array(count).fill(order[index]));
    return _.flatten(nestedPartsLists)
}

//cost and store functions
function cost(recipe){
    var costList = _.map(recipe, part => BODYPART_COST[part]);
    return _.sum(costList)
}
function store(recipe){
    return _.filter(recipe, part => part == CARRY).length * CARRY_CAPACITY
}
function dMinerCalc(room, boosted, flagName){
    const city = room.memory.city;
    const spawn = Game.spawns[city];
    const baseBody = [1, 1, 1];
    const flag = Memory.flags[flagName];
    if(!flag){
        return baseBody
    }
    let harvested = flag.harvested;
    if(!harvested){
        harvested = 0;
    }
    //distance calculated using method of travel for consistency
    const distance = motion.getRoute(spawn.pos.roomName, flag.roomName, true).length * 50;
    const workTime = CREEP_LIFE_TIME - (distance * 3);//distance x 3 since it'll take 2x as long on return
    
    const result = depositMinerBody(workTime, harvested, boosted, baseBody);
    if (_.isEqual(result, baseBody)) {
        delete Memory.flags[flagName];
    }
    return result
}

function depositMinerBody(workTime, harvested, boosted, baseBody) {
    let works = 20;
    let carries = getCarriesFromWorks(works, workTime, harvested, boosted);
    if(carries < 8){// if we're getting less than 400 resource in a lifetime, drop the source
        return baseBody
    }
    if(carries > 10){
        //body is impossible so we have to decrease works
        for(var i = 0; i < 2; i++){
            works = works/2;
            carries = getCarriesFromWorks(works, workTime, harvested, boosted);
            const moves = Math.max(Math.ceil((works + carries)/2), works);
            if(works + carries + moves <= MAX_CREEP_SIZE){
                return [works, carries, moves]
            }
        }
        //can't go under 5 works => make max body
        const moves = Math.floor(MAX_CREEP_SIZE / 3);
        carries = 2 * moves - works;
        return [works, carries, moves]
    } else {
        const moves = works;
        return [works, carries, moves]
    }
}

function getCarriesFromWorks(works, workTime, alreadyHarvested, boosted) {
    const workPower = getWorkPower(works, boosted);
    const carryAmount = 
        getHarvestResults(workPower, workTime, alreadyHarvested) - alreadyHarvested;
    return getCarriesNeeded(carryAmount, boosted)
}

function getWorkPower(work, boosted) {
    if (boosted) return work * BOOSTS[WORK][RESOURCE_CATALYZED_UTRIUM_ALKALIDE].harvest
    else return work
}

function getCarriesNeeded(resourceAmount, boosted) {
    const boostMultiple = BOOSTS[CARRY][RESOURCE_CATALYZED_KEANIUM_ACID].capacity;
    const resourcesPerCarry = boosted ? CARRY_CAPACITY * boostMultiple : CARRY_CAPACITY;
    return Math.floor(resourceAmount/resourcesPerCarry)
}

function calcCooldown(harvested) {
    return Math.ceil(DEPOSIT_EXHAUST_MULTIPLY*Math.pow(harvested,DEPOSIT_EXHAUST_POW))
}

function getHarvestResults(works, ticks, harvested){
    if(ticks <= 0){
        return harvested
    } else {
        return getHarvestResults(works, ticks - calcCooldown(harvested + works) - 1, harvested + works)
    }
}

function pMinerBody(boosted){
    if(boosted){
        return body([3, 16, 19], [TOUGH, ATTACK, MOVE])
    }
    return body([20, 20], [MOVE, ATTACK])
}

function minerBody(energyAvailable, rcl) {
    // miners. at least 1 move. 5 works until we can afford 10
    let works = Math.floor((energyAvailable) / BODYPART_COST[WORK]);
    if (works >= 25 && rcl > 7 && !PServ) works = 25;
    else if (works > 10 && (!PServ || rcl >= 6)) works = 10;
    else if (works > 6) works = 6;
    else works = Math.max(1, works);
    const energyAfterWorks = energyAvailable - works * BODYPART_COST[WORK];
    const moves = rcl >= 6 ? Math.floor(Math.min(Math.ceil(works / 2), Math.max(1, energyAfterWorks / BODYPART_COST[MOVE]))): 0;
    const energyAfterMoves = energyAfterWorks - moves * BODYPART_COST[MOVE];
    const minCarries = energyAfterMoves/BODYPART_COST[CARRY] >= 1 ? 1 : 0;
    
    // Figure out how many carries we can afford/will fill the link in fewest ticks
    const carriesPerLinkFill = Game.cpu.bucket < 9500 ? Math.ceil(LINK_CAPACITY / CARRY_CAPACITY) : Math.ceil(LINK_CAPACITY / CARRY_CAPACITY)/4;
    const loadsNeeded = (c => c <= 0 ? Infinity : Math.ceil(carriesPerLinkFill / c));
    const storeChoices = [...Array(carriesPerLinkFill + 1).keys()] // range [0,n + 1]
        .filter(c => loadsNeeded(c) < loadsNeeded(c - 1)) // more carries => fewer loads?
        .filter(c => c <= energyAfterMoves / BODYPART_COST[CARRY])  // how many can we afford?
        .filter(c => works + c + moves <= MAX_CREEP_SIZE);
    const carries = rcl >= 6 ? Math.max(...storeChoices, minCarries) : minCarries;
    return body([works, carries, moves], [WORK, CARRY, MOVE])
}

function upgraderBody(energyAvailable, rcl, room) {
    const controller = room.controller;
    const isBoosted = controller.effects && controller.effects.length > 0;
    const boost = isBoosted ? 
        POWER_INFO[PWR_OPERATE_CONTROLLER].effect[controller.effects[0].level - 1] : 0;
    const maxWorks = CONTROLLER_MAX_UPGRADE_PER_TICK + boost;
    const types = [WORK, CARRY, MOVE];
    if (rcl > 4 && rcl < 8) { // use boost ratio 5 work, 3 store
        return scalingBody([4, 1, 1], types, energyAvailable)
    } else if (isBoosted) {
        return scalingBody([4, 1, 1], types, energyAvailable, Math.min(maxWorks * 1.5, MAX_CREEP_SIZE))
    } else if (rcl == 8){// don't go over 15 work for rcl8
        return scalingBody([5, 1, 2], types, energyAvailable, 24)
    } else {
        return scalingBody([1, 1, 1], types, energyAvailable)
    }
}

function builderBody(energyAvailable, rcl) {
    let ratio = [2,1,1]; // ratio at rcl1
    const ratio4 = [5,9,7];
    const ratio7 = [15,18,17];
    const types = [WORK, CARRY, MOVE];
    if (rcl >= 2) return scalingBody([1, 1, 1], types, energyAvailable)
    if (rcl >= 4 && energyAvailable > cost(body(ratio4, types))) ratio = ratio4;
    if (rcl >= 7 && energyAvailable > cost(body(ratio7, types))) ratio = ratio7;
    return body(ratio, types)
}

function quadBody(energyAvailable, rcl, room, boosted){
    if(boosted){
        //make boosted variant
        if(rcl == 8){
            return body([2, 18, 9, 8, 1, 12], [TOUGH, RANGED_ATTACK, MOVE, TOUGH, MOVE, HEAL])
        }
        if(rcl == 7){
            const ratio = [1, 4, 1, 1, 1, 2];
            const types = [TOUGH, RANGED_ATTACK, MOVE, TOUGH, MOVE, HEAL];
            return scalingBody(ratio, types, energyAvailable)
        }
    }
    //make unboosted variant
    const types = [RANGED_ATTACK, MOVE, HEAL];
    let ratio = [0, 1, 0];
    switch(rcl){
    case 2:
        ratio = [1, 2, 1];
        break
    case 3:
        ratio = [2, 3, 1];
        break
    case 4:
        ratio = [5, 6, 1];
        break
    case 5:
        ratio = [3, 4, 1];
        break
    case 6:
        ratio = [7, 10, 3];
        break
    case 7:
        ratio = [10, 22, 12];
        break
    case 8:
        ratio = [13, 25, 12];
        break
    }
    return scalingBody(ratio, types, energyAvailable)
}

function defenderBody(energyAvailable, rcl, boosted) {
    if(boosted){
        if(rcl == 8){
            return body([6, 22, 10, 12], [TOUGH, RANGED_ATTACK, MOVE, HEAL])
        }
        if(rcl == 7){
            return scalingBody([1, 9, 3, 2], [TOUGH, RANGED_ATTACK, MOVE, HEAL], energyAvailable)
        }
    }
    const ratio = [3, 4, 1];
    const types = [RANGED_ATTACK, MOVE, HEAL];
    const baseCost = cost(body(ratio, types));
    if(baseCost > energyAvailable){
        return body([1, 1], [RANGED_ATTACK, MOVE])
    }
    return scalingBody(ratio, types, energyAvailable)
}

function harasserBody(energyAvailable, boosted, rcl){
    if(boosted){
        if(rcl == 8)
            return body([3, 31, 10, 6], [TOUGH, RANGED_ATTACK, MOVE, HEAL])
        if(rcl == 7)
            return scalingBody([1, 9, 3, 2], [TOUGH, RANGED_ATTACK, MOVE, HEAL], energyAvailable)
    }
    return scalingBody([4, 5, 1], [RANGED_ATTACK, MOVE, HEAL], energyAvailable)
}

function breakerBody(energyAvailable, rcl, boosted){
    if(!boosted){
        return scalingBody([1 , 1], [WORK, MOVE], energyAvailable)
    }
    return scalingBody([1, 3, 1], [TOUGH, WORK, MOVE], energyAvailable)
}

function medicBody(energyAvailable, rcl, boosted){
    if(!boosted){
        return scalingBody([1 , 1], [HEAL, MOVE], energyAvailable)
    }
    return scalingBody([1, 3, 1], [TOUGH, HEAL, MOVE], energyAvailable)
}

/** TODO support for fractional scaling
 * ratio: ratio of parts in an array. i.e. [2, 1, 2]
 * types: types of part in an array. Must be same length as ratio. i.e. [MOVE, CARRY, MOVE]
 * energyAvailable: energy to use on this creep
 * maxOverride: (optional) max number of body parts to use on this creep
 */
function scalingBody(ratio, types, energyAvailable, maxOverride) {
    const baseCost = cost(body(ratio, types));
    const maxSize = maxOverride || MAX_CREEP_SIZE;
    const energy = energyAvailable || 0;
    const scale = Math.max(Math.floor(Math.min(energy / baseCost, maxSize / _.sum(ratio))), 1);
    return body(ratio.map(x => x * scale), types)
}

var types = {
    getRecipe: getRecipe,
    cost: cost,
    store: store,
    body: body,
    depositMinerBody: depositMinerBody,
};
types.getRecipe;
types.cost;
types.store;
types.body;
types.depositMinerBody;

var labs = {
    //new labs:
    //all 10 labs in one cluster. reactors built first and identified based on position relative to other lab SITES
    //receivers are identified and begin use as soon as they are built
    //reactors are in a list in labInfo.reactors
    //receivers are in a list in labInfo.receivers
    //receivers have a mineral attribute. if null or undefined, operate as normal
    //if receiver has a mineral assigned in its mineral attribute, don't react into it, and use it for boosting (with assigned mineral)
    //fill codes:
    //  0: do nothing
    //  [positive integer]: fill with integer * 1000 resource
    //  -1: empty

    /* Example: 
    labInfo:
        boost: [RESOURCE_CONSTANT]
        reactors:
            0: 
                id: reactorId
                mineral: [RESOURCE_CONSTANT]
                fill: 0
            1: 
                id: reactorId
                mineral: [RESOURCE_CONSTANT]
                fill: 0
        receivers
            0:
                id: [object Id]
                boost: [RESOURCE_CONSTANT]
                fill: 1
            1:
            .
            .
            .
    */

    run: function(city){
        const spawn = Game.spawns[city];
        if (!spawn.memory.ferryInfo || !spawn.memory.ferryInfo.labInfo || !spawn.memory.ferryInfo.labInfo.reactors){
            return
        }
        if(spawn.memory.ferryInfo.labInfo.boost == "dormant" && Game.time % 1000 != 0){
            return
        }
        //if a reactor is missing, return
        const reactor0 = Game.getObjectById(Object.keys(spawn.memory.ferryInfo.labInfo.reactors)[0]);
        const reactor1 = Game.getObjectById(Object.keys(spawn.memory.ferryInfo.labInfo.reactors)[1]);
        if(!reactor0 || !reactor1 || !spawn.room.terminal){
            return
        }

        //if reactors are empty, choose next reaction, set all receivers to get emptied
        if(!reactor0.mineralType || !reactor1.mineralType){
            //if reactors are not requesting fill, update reaction
            labs.updateLabs(reactor0, reactor1, spawn);
            return
        }

        if(spawn.memory.ferryInfo.labInfo.boost){
            //loop thru receivers, react in each one that is not designated as a booster
            labs.runReaction(spawn.memory.ferryInfo.labInfo.receivers, reactor0, reactor1);
        }
    },

    updateLabs: function(reactor0, reactor1, spawn){
        if(spawn.memory.ferryInfo.labInfo.reactors[reactor0.id].fill || spawn.memory.ferryInfo.labInfo.reactors[reactor1.id].fill){
            if(Game.time % 200000 == 0){
                spawn.memory.ferryInfo.labInfo.reactors[reactor0.id].fill = -1;
                spawn.memory.ferryInfo.labInfo.reactors[reactor1.id].fill = -1;
            }
            return//if either of the reactors is requesting a fill up, no need to choose a new mineral
        }
        if(reactor0.mineralType || reactor1.mineralType){
            spawn.memory.ferryInfo.labInfo.reactors[reactor0.id].fill = -1;
            spawn.memory.ferryInfo.labInfo.reactors[reactor1.id].fill = -1;
            return
        }
        //if that is not the case, all receivers must be emptied
        let oldMineral = null;
        for(let i = 0; i < Object.keys(spawn.memory.ferryInfo.labInfo.receivers).length; i++){
            const receiver = Game.getObjectById(Object.keys(spawn.memory.ferryInfo.labInfo.receivers)[i]);
            if(!spawn.memory.ferryInfo.labInfo.receivers[receiver.id].boost && receiver.mineralType){
                //empty receivers if they are not boosters and have minerals
                spawn.memory.ferryInfo.labInfo.receivers[receiver.id].fill = -1;
                //record mineral that was produced
                if(receiver.mineralType){
                    oldMineral = receiver.mineralType;
                }
            }
        }
        if(oldMineral == spawn.memory.ferryInfo.labInfo.boost || !spawn.memory.ferryInfo.labInfo.boost
            || spawn.memory.ferryInfo.labInfo.boost == "dormant"){
            labs.chooseBoost(oldMineral, spawn);
            if(spawn.memory.ferryInfo.labInfo.boost == "dormant"){
                return
            }
        }
        //choose new mineral to be made
        spawn.room.terminal.store[oldMineral] += 3000;
        const boost = spawn.memory.ferryInfo.labInfo.boost;
        const minerals = labs.chooseMineral(boost, spawn);
        if (!minerals){
            return
        }
        Object.values(spawn.memory.ferryInfo.labInfo.reactors)[0].mineral = minerals[0];
        Object.values(spawn.memory.ferryInfo.labInfo.reactors)[1].mineral = minerals[1];
        Object.values(spawn.memory.ferryInfo.labInfo.reactors)[0].fill = 3;
        Object.values(spawn.memory.ferryInfo.labInfo.reactors)[1].fill = 3;
    },

    chooseBoost: function(currentBoost, spawn){
        const minBoost = _.min(settings_1.militaryBoosts, function(boost) {
            return spawn.room.storage.store[boost] || 0 + spawn.room.terminal.store[boost] || 0
        });

        if(spawn.room.storage.store[minBoost] < settings_1.boostAmount){
            spawn.memory.ferryInfo.labInfo.boost = minBoost;
            return
        }
        for(const boost of settings_1.civBoosts){
            if (boost == currentBoost && spawn.room.storage.store[currentBoost] > settings_1.boostAmount - 3000){
                continue
            }
            if(spawn.room.storage.store[boost] < settings_1.boostAmount){
                spawn.memory.ferryInfo.labInfo.boost = boost;
                return
            }
        }
        //go dormant
        spawn.memory.ferryInfo.labInfo.boost = "dormant";
    },

    runReaction: function(receivers, reactor0, reactor1) {
        if (reactor0.mineralType && reactor1.mineralType){
            const produce = REACTIONS[reactor0.mineralType][reactor1.mineralType];
            const reactionTime = REACTION_TIME[produce];
            if (Game.time % reactionTime === 4 && Game.cpu.bucket > 2000){
                const receiverList = Object.keys(receivers);
                for(let i = 0; i < receiverList.length; i++){
                    const lab = Game.getObjectById(receiverList[i]);
                    if(lab){
                        if(!receivers[receiverList[i]].boost){
                            lab.runReaction(reactor0, reactor1);
                            continue
                        }
                        if(!lab.mineralType && !receivers[receiverList[i]].fill){
                            receivers[receiverList[i]].boost = null;
                            continue
                        }

                        const labCache = utils.getLabCache(receiverList[i]);
                        if(labCache.amount != lab.store[lab.mineralType]){
                            labCache.amount = lab.store[lab.mineralType];
                            labCache.lastUpdate = Game.time;
                            continue
                        }
                        if(labCache.lastUpdate < Game.time - CREEP_LIFE_TIME && !receivers[receiverList[i]].fill){
                            receivers[receiverList[i]].boost = null;
                            receivers[receiverList[i]].fill = -1;
                        }
                    }
                }
            }
            return 0
        }
        return -1
    },

    chooseMineral: function(mineral, spawn) {
        //if requesting mineral, early return
        if (spawn.memory.ferryInfo.mineralRequest){
            if(Game.time % 50 == 26){
                spawn.memory.ferryInfo.mineralRequest = null;
            }
            return 0
        }
        const ingredients = labs.findIngredients(mineral);
        //if no ingredients, request mineral
        if (!ingredients){
            spawn.memory.ferryInfo.mineralRequest = mineral;
            return 0
        }
        const ferry = _.find(spawn.room.find(FIND_MY_CREEPS), creep => creep.memory.role === "ferry");
        if(ferry && _.sum(ferry.store)){
            return
        }
        //if we don't have both ingredients find the one we don't have and find it's ingredients
        for(let i = 0; i < 2; i++){
            if (spawn.room.terminal.store[ingredients[i]] < 3000){
                return labs.chooseMineral(ingredients[i], spawn)
            }
        }
        //if we have both ingredients, load them up
        return ingredients
    },

    findIngredients: function(mineral){
        let result = 0;
        _.forEach(Object.keys(REACTIONS), function(key){
            _.forEach(Object.keys(REACTIONS[key]), function(key2){
                if (REACTIONS[key][key2] == mineral){
                    result = [key, key2];
                }
            });
        });
        return result
    }
};
var labs_1 = labs;

var error = {
    errorThisTick: false,
    exception: null,

    reset: function() {
        error.errorThisTick = false;
        error.exception = null;
    },

    reportError: function(exception) {
        error.errorThisTick = true;
        error.exception = exception;
    },

    finishTick: function() {
        if (error.errorThisTick) {
            const e = error.exception;
            Log.error(`${e.message}: ${e.stack}`);
            Game.notify(`${e.message}: ${e.stack}`);
        }
    }
};

var error_1 = error;

function makeCreeps(role, city, unhealthyStore, creepWantsBoosts, flag = null) {
    if(Memory.gameState < 4) return false
    const room = Game.spawns[city].room;
   
    var energyToSpend = unhealthyStore ? room.energyAvailable :
        room.energyCapacityAvailable;

    const weHaveBoosts = utils.boostsAvailable(role, room);
    const boosted = creepWantsBoosts && weHaveBoosts;

    const recipe = types.getRecipe(role.type, energyToSpend, room, boosted, flag);
    const spawns = room.find(FIND_MY_SPAWNS);
    if(!Memory.counter){
        Memory.counter = 0;
    }
    const name = utils.generateCreepName(Memory.counter.toString(), role.name);
    if (types.cost(recipe) > room.energyAvailable) return false

    const spawn = utils.getAvailableSpawn(spawns);
    if (!spawn) return false

    Memory.counter++;
    const result = spawn.spawnCreep(recipe, name);
    if (result) { // don't spawn and throw an error at the end of the tick
        error_1.reportError(new Error(`Error making ${role.name} in ${city}: ${result}`));
        return false
    }
    if (boosted) {
        utils.requestBoosterFill(Game.spawns[city], role.boosts);
    }
    Game.creeps[name].memory.role = role.name;
    Game.creeps[name].memory.target = role.target;
    Game.creeps[name].memory.city = city;
    Game.creeps[name].memory.needBoost = boosted;
    Game.creeps[name].memory.flag = flag;
    return true
}

//runCity function
function runCity(city, creeps){
    const spawn = Game.spawns[city];
    if (!spawn) return false
    const room = spawn.room;

    updateSpawnStress(spawn);

    // Only build required roles during financial stress
    const emergencyRoles = roles.getEmergencyRoles();
    const allRoles = roles.getRoles();

    const storage = utils.getStorage(room);
    const halfCapacity = storage && storage.store.getCapacity() / 2;
    const unhealthyStore = storage && storage.store[RESOURCE_ENERGY] < Math.min(5000, halfCapacity);
    var roles$1 = (unhealthyStore) ? emergencyRoles : allRoles;

    // Get counts for roles by looking at all living and queued creeps
    var nameToRole = _.groupBy(allRoles, role => role.name); // map from names to roles
    var counts = _.countBy(creeps, creep => creep.memory.role); // lookup table from role to count
    const queuedCounts = spawnQueue.getCounts(spawn);
    _.forEach(roles$1, role => {
        const liveCount = counts[role.name] || 0;
        const queueCount = queuedCounts[role.name] || 0;
        counts[role.name] = liveCount + queueCount;
    });

    if(Game.time % 50 == 0 && spawn.memory.sq.length){
        const priorities = roles.getRolePriorities();
        spawn.memory.sq = _.sortBy(spawn.memory.sq, item => priorities[item.role]);
    }
    
    let usedQueue = true;
    const nextRoleInfo = spawnQueue.peekNextRole(spawn) || {};
    const spawnQueueRoleName = nextRoleInfo.role;
    let nextRole = spawnQueueRoleName ? nameToRole[spawnQueueRoleName][0] : undefined;

    if (!nextRole) {
        nextRole = _.find(roles$1, role => (typeof counts[role.name] == "undefined" && 
        spawn.memory[role.name]) || (counts[role.name] < spawn.memory[role.name]));
        usedQueue = false;
    }
    
    if (nextRole) {
        if(makeCreeps(nextRole, city, unhealthyStore, nextRoleInfo.boosted, nextRoleInfo.flag) && usedQueue){
            spawnQueue.removeNextRole(spawn);
        }
    }

    // Run all the creeps in this city
    _.forEach(creeps, (creep) => {
        nameToRole[creep.memory.role][0].run(creep);
    });
    
    link.run(room);

    //run powerSpawn
    runPowerSpawn(city);
    labs_1.run(city);
    factory.runFactory(city);
    checkNukes(room);
}

//updateCountsCity function
function updateCountsCity(city, creeps, rooms, claimRoom, unclaimRoom) {
    const spawn = Game.spawns[city];
    if (!spawn) return false
    const memory = spawn.memory;
    const controller = spawn.room.controller;
    const rcl = controller.level;
    const rcl8 = rcl > 7;
    const emergencyTime = spawn.room.storage && spawn.room.storage.store.energy < 5000 && rcl > 4 || 
                (rcl > 6 && !spawn.room.storage);
    const logisticsTime = rcl8 && !emergencyTime ? 500 : 50;

    // Always update defender
    updateDefender(spawn, rcl);
    updateQR(spawn, creeps);

    if(Game.time % 200 == 0){
        updateMilitary(city, memory, rooms, spawn, creeps);
    }
    if (Game.time % logisticsTime == 0) {
        const structures = spawn.room.find(FIND_STRUCTURES);
        const extensions = _.filter(structures, structure => structure.structureType == STRUCTURE_EXTENSION).length;
        updateRunner(creeps, spawn, extensions, memory, rcl, emergencyTime);
        updateFerry(spawn, memory, rcl);
        updateMiner(rooms, rcl8, memory, spawn);
        updateBuilder(rcl, memory, spawn);
    
        if (Game.time % 500 === 0) {
            runNuker(city);
            checkLabs(city);
            updateTransporter(extensions, memory, creeps, structures, spawn);
            updateColonizers(city, memory, claimRoom, unclaimRoom);
            updateUpgrader(city, controller, memory, rcl8, creeps, rcl);
            updateMineralMiner(rcl, structures, spawn, memory);
            updatePowerSpawn(city, memory);
            updateStorageLink(spawn, memory, structures);
        }
        makeEmergencyCreeps(extensions, creeps, city, rcl8, emergencyTime); 
    }
}

function checkNukes(room){
    if(Game.time % 1000 === 3){
        const nukes = room.find(FIND_NUKES);
        if(nukes.length){
            Game.notify("Nuclear launch detected in " + room.name, 720);
        }
    }
}

function makeEmergencyCreeps(extensions, creeps, city, rcl8, emergency) {
    const checkTime = rcl8 ? 200 : 50;
    const memory = Game.spawns[city].memory;

    if (emergency || Game.time % checkTime == 0 && extensions >= 1) {
        if (_.filter(creeps, creep => creep.memory.role == remoteMiner.name).length < 1 && memory[remoteMiner.role] > 0){
            Log.info(`Making Emergency Miner in ${city}`);
            makeCreeps(remoteMiner, city, true);
        }

        if (_.filter(creeps, creep => creep.memory.role == transporter.name).length < 1){
            Log.info(`Making Emergency Transporter in ${city}`);
            makeCreeps(transporter, city, true);
        }

        // TODO disable if links are present (not rcl8!! links may be missing for rcl8)
        if ((emergency || !rcl8) && _.filter(creeps, creep => creep.memory.role == runner.name ).length < 1 && memory.runner > 0) {
            Log.info(`Making Emergency Runner in ${city}`);
            makeCreeps(runner, city, true);
        }
    }
}

function updateQR(spawn, creeps){
    if(Game.time % 100 == 5){
        const flag = spawn.name + "qrCode";
        if(Memory.flags[flag]){
            const creepsNeeded = _.sum(template.qrCoords, elem => elem.length);
            scheduleIfNeeded(qrCode.name, creepsNeeded, false, spawn, creeps, flag);
        }
    }
}

// Run the tower function
function runTowers(city){
    const spawn = Game.spawns[city];
    if (spawn){
        if(spawn.memory.towersActive == undefined){
            spawn.memory.towersActive = false;
        }
        const checkTime = 20;
        if(spawn.memory.towersActive == false && Game.time % checkTime != 0){
            return
        }
        var towers = _.filter(spawn.room.find(FIND_MY_STRUCTURES), (structure) => structure.structureType == STRUCTURE_TOWER);
        var hostileCreep = spawn.room.find(FIND_HOSTILE_CREEPS);
        var injuredCreep = spawn.room.find(FIND_MY_CREEPS, {filter: (injured) => { 
            return (injured) && injured.hits < injured.hitsMax
        }});
        var injuredPower = spawn.room.find(FIND_MY_POWER_CREEPS, {filter: (injured) => { 
            return (injured) && injured.hits < injured.hitsMax
        }});
        var hostilePower = spawn.room.find(FIND_HOSTILE_POWER_CREEPS);
        var hostiles = _.filter(hostilePower.concat(hostileCreep), c => !settings_1.allies.includes(c.owner.username));
        var injured = injuredPower.concat(injuredCreep);
        let damaged = null;
        let repair = 0;
        let target = null;
        maybeSafeMode(city, hostiles);
        if (Game.time % checkTime === 0) {
            const needRepair = _.filter(spawn.room.find(FIND_STRUCTURES), s => s.structureType != STRUCTURE_WALL
                && s.structureType != STRUCTURE_RAMPART
                && s.structureType != STRUCTURE_CONTAINER
                && s.hitsMax - s.hits > TOWER_POWER_REPAIR);//structure must need at least as many hits missing as a minimum tower shot
            if(needRepair.length){
                damaged =  _.min(needRepair, function(s) {
                    return s.hits/s.hitsMax
                });
            }
            if(damaged){
                repair = damaged.hitsMax - damaged.hits;
            }
        }

        const lowEnergy = spawn.room.storage && spawn.room.terminal && spawn.room.storage.store.energy < 40000;
        if(hostiles.length > 0  && !lowEnergy){
            Log.info("Towers up in " + city);
            spawn.memory.towersActive = true;
            //identify target 
            target = tower.chooseTarget(towers, hostiles, spawn.pos.roomName);
        } else {
            spawn.memory.towersActive = false;
        }
        for (let i = 0; i < towers.length; i++){
            if(target){
                towers[i].attack(target);
            } else if (injured.length > 0 && !hostiles.length){
                towers[i].heal(injured[0]);
            } else if (Game.time % checkTime === 0 && damaged){
                if(repair < TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)){
                    continue
                }
                const distance = towers[i].pos.getRangeTo(damaged.pos);
                const damage_distance = Math.max(TOWER_OPTIMAL_RANGE, Math.min(distance, TOWER_FALLOFF_RANGE));
                const steps = TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE;
                const step_size = TOWER_FALLOFF * TOWER_POWER_REPAIR / steps;
                const repStrength = TOWER_POWER_REPAIR - (damage_distance - TOWER_OPTIMAL_RANGE) * step_size;
                if(repStrength <= repair){
                    towers[i].repair(damaged);
                    repair -= repStrength; 
                }
            }
        }
    }
}

function maybeSafeMode(city, hostiles){
    const room = Game.spawns[city].room;
    const plan = Memory.rooms[room.name].plan;
    if(!plan) return
    const minX = plan.x - template.wallDistance;
    const minY = plan.y - template.wallDistance;
    const maxX = plan.x + template.dimensions.x + template.wallDistance - 1;
    const maxY = plan.y + template.dimensions.y + template.wallDistance - 1;
    if(_.find(hostiles, h => h.pos.x > minX 
            && h.pos.x < maxX 
            && h.pos.y > minY
            && h.pos.y < maxY)
        && room.controller.safeModeAvailable
        && !room.controller.safeModeCooldown){
        room.controller.activateSafeMode();
    }
}

//Run the powerSpawn
function runPowerSpawn(city){
    if(Game.spawns[city]){
        if (!Game.spawns[city].memory.powerSpawn){
            return
        }
        var powerSpawn = Game.getObjectById(Game.spawns[city].memory.powerSpawn);
        if (Game.time % 20 === 0){
            if (!Game.spawns[city].memory.ferryInfo){
                Game.spawns[city].memory.ferryInfo = {};
            }
            if(powerSpawn && powerSpawn.power < 30){
                Game.spawns[city].memory.ferryInfo.needPower = true;
            } else {
                Game.spawns[city].memory.ferryInfo.needPower = false;
            }
        }
        if(settings_1.processPower && powerSpawn && powerSpawn.energy >= 50 && powerSpawn.power > 0 && powerSpawn.room.storage.store.energy > settings_1.energy.processPower && Game.cpu.bucket > settings_1.bucket.processPower){
            powerSpawn.processPower();
        }
    }
}

function updatePowerSpawn(city, memory) {
    if (!memory.ferryInfo){
        memory.ferryInfo = {};
    }
    const powerSpawn = _.find(Game.structures, (structure) => structure.structureType == STRUCTURE_POWER_SPAWN && structure.room.memory.city == city);
    if (powerSpawn){
        memory.powerSpawn = powerSpawn.id;
    }
}

function initLabInfo(memory){
    if(!memory.ferryInfo){
        memory.ferryInfo = {};
    }
    if(!memory.ferryInfo.labInfo){
        memory.ferryInfo.labInfo = {};
        memory.ferryInfo.labInfo.receivers = {};
        memory.ferryInfo.labInfo.reactors = {};
    }
}

function checkLabs(city){
    const spawn = Game.spawns[city];
    const labs = _.filter(spawn.room.find(FIND_MY_STRUCTURES), structure => structure.structureType === STRUCTURE_LAB);
    if (labs.length < 3){
        return
    }
    initLabInfo(spawn.memory);
    //check if we need to do a rescan
    let rescan = false;
    const receivers = Object.keys(spawn.memory.ferryInfo.labInfo.receivers);
    const reactors = Object.keys(spawn.memory.ferryInfo.labInfo.reactors);
    for(let i = 0; i < receivers.length; i++){
        if(!Game.getObjectById(receivers[i])){
            rescan = true;
            delete(spawn.memory.ferryInfo.labInfo.receivers[receivers[i]]);
        }
    }
    for(let i = 0; i < reactors.length; i++){
        if(!Game.getObjectById(reactors[i])){
            rescan = true;
            delete(spawn.memory.ferryInfo.labInfo.reactors[reactors[i]]);
        }
    }
    if(labs.length > receivers.length + reactors.length){
        rescan = true;
    }
    if(!rescan){
        return
    }

    //now we need a rescan, but we must make sure not to overwrite any labInfo that already exists
    const unassignedLabs = _.filter(labs, lab => !receivers.includes(lab.id) && !reactors.includes(lab.id));
    const plan = spawn.room.memory.plan;
    for(let i = 0; i < unassignedLabs.length; i++){
        const templatePos = {"x": unassignedLabs[i].pos.x + template.offset.x - plan.x, "y": unassignedLabs[i].pos.y + template.offset.y - plan.y};
        if((templatePos.x == template.buildings.lab.pos[0].x && templatePos.y == template.buildings.lab.pos[0].y) 
            ||(templatePos.x == template.buildings.lab.pos[1].x && templatePos.y == template.buildings.lab.pos[1].y)){
            //lab is a reactor
            spawn.memory.ferryInfo.labInfo.reactors[unassignedLabs[i].id] = {};
        } else {
            //lab is a receiver
            spawn.memory.ferryInfo.labInfo.receivers[unassignedLabs[i].id] = {};
        }
    }
}

function updateMilitary(city, memory, rooms, spawn, creeps) {
    const flags = ["harass", "powerMine", "deposit"];
    const roles = [libb.name, powerMiner.name, depositMiner.name];
    for (var i = 0; i < flags.length; i++) {
        const flagName = city + flags[i];
        const role = roles[i];
        updateHighwayCreep(flagName, spawn, creeps, role);
    }
}

function chooseClosestRoom(myCities, flag){
    if(!flag){
        return 0
    }
    const goodCities = _.filter(myCities, city => city.controller.level >= 4 && Game.spawns[city.memory.city] && city.storage);
    let closestRoomPos = goodCities[0].getPositionAt(25, 25);
    let closestLength = CREEP_CLAIM_LIFE_TIME + 100;//more than max claimer lifetime
    for (let i = 0; i < goodCities.length; i += 1){
        const testRoomPos = goodCities[i].getPositionAt(25, 25);
        const testPath = utils.findMultiRoomPath(testRoomPos, flag);
        if(!testPath.incomplete && testPath.cost < closestLength && goodCities[i].name != flag.roomName){
            closestRoomPos =  goodCities[i].getPositionAt(25, 25);
            closestLength = testPath.cost;
        }
    }
    if(closestLength == 700){
        Game.notify("No valid rooms in range for claim operation in " + flag.roomName);
    }
    return closestRoomPos.roomName
}

function updateColonizers(city, memory, claimRoom, unclaimRoom) {
    //claimer and spawnBuilder reset
    // TODO only make a claimer if city is close
    const roomName = Game.spawns[city].room.name;
    if(roomName == claimRoom){
        const flag = Memory.flags.claim;
        const harassFlagName = utils.generateFlagName(city + "harass");
        if(!_.find(Object.keys(Memory.flags), f => Memory.flags[f].roomName == Memory.flags.claim.roomName && f.includes("harass"))){
            Memory.flags[harassFlagName] = new RoomPosition(25, 25, Memory.flags.claim.roomName);
            Memory.flags[harassFlagName].boosted = true;
        }
        if(Game.spawns[city].room.controller.level < 7){
            memory[spawnBuilder.name] = 4;
        } else if (flag && Game.rooms[flag.roomName] && Game.rooms[flag.roomName].controller && Game.rooms[flag.roomName].controller.level > 6) {
            memory[spawnBuilder.name] = 4;
        } else {
            memory[spawnBuilder.name] = 2;
        }
        if(flag && Game.rooms[flag.roomName] && Game.rooms[flag.roomName].controller.my){
            memory[claimer.name] = 0;
        } else {
            memory[claimer.name] = flag ? 1 : 0;
        }
    } else {
        memory[spawnBuilder.name] = 0;
        memory[claimer.name] = 0;
    }
    if (roomName == unclaimRoom && Game.time % 1000 == 0) {
        spawnQueue.schedule(Game.spawns[city], unclaimer.name);
    }
    //memory[rRo.name] = 0;
}

// Automated defender count for defense
function updateDefender(spawn, rcl) {
    if (Game.time % 30 != 0) {
        return
    }
    const room = spawn.room;
    if(spawn.memory.towersActive){
        if(rcl < 6){
            spawn.memory[defender.name] = Math.ceil(room.find(FIND_HOSTILE_CREEPS).length/2);
            return
        }
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        for(const hostile of hostiles){
            const hasTough = hostile.getActiveBodyparts(TOUGH) > 0;
            const isBoosted = _(hostile.body).find(part => part.boost);
            if (isBoosted && (hasTough || isBoosted.boost.includes("X") || rcl < 8)) {
                //add a defender to spawn queue if we don't have enough
                //make sure to count spawned defenders as well as queued
                const spawns = room.find(FIND_MY_SPAWNS);
                const spawning = _.filter(spawns, s => s.spawning && Game.creeps[s.spawning.name].memory.role == defender.name).length;
                const defendersNeeded = Math.ceil(hostiles.length/2);
                const liveCount = _.filter(room.find(FIND_MY_CREEPS), c => c.memory.role == defender.name).length;
                const queued = spawnQueue.getCounts(spawn)[defender.name] || 0;
                if(spawning + liveCount + queued < defendersNeeded){
                    spawnQueue.schedule(spawn, defender.name, true);
                }
                return
            }
        }
    } else {
        spawn.memory[defender.name] = 0;
    }
}

function cityFraction(cityName) {
    const myCities = _.map(utils.getMyCities(), city => city.name).sort();
    return _.indexOf(myCities, cityName) / myCities.length
}

function updateMiner(rooms, rcl8, memory, spawn){   
    if (!memory.sources) memory.sources = {};
    if (rcl8 && _.keys(memory.sources).length > 2) memory.sources = {};
    let miners = 0;
    const miningRooms = rcl8 ? [spawn.room] : rooms;
    const sources = _.flatten(_.map(miningRooms, room => room.find(FIND_SOURCES)));

    _.each(sources, function(sourceInfo){
        const sourceId = sourceInfo.id;
        const sourcePos = sourceInfo.pos;
        if (!([sourceId] in memory.sources)){
            memory.sources[sourceId] = sourcePos;
        }
    });     
    if(rcl8){
        const powerCreeps = spawn.room.find(FIND_MY_POWER_CREEPS);
        let bucketThreshold = settings_1.bucket.energyMining + settings_1.bucket.range * cityFraction(spawn.room.name); 
        if(powerCreeps.length && powerCreeps[0].powers[PWR_REGEN_SOURCE] || spawn.room.storage.store[RESOURCE_ENERGY] < settings_1.energy.processPower){
            bucketThreshold -= settings_1.bucket.range/2;
        }
        if (Game.cpu.bucket < bucketThreshold) {
            memory[remoteMiner.name] = 0;
            return
        }

        if(_.find(spawn.room.find(FIND_MY_CREEPS), c => c.memory.role == defender.name)){
            memory[remoteMiner.name] = 0;
        } else {
            memory[remoteMiner.name] = 2;
        }
        return
    }
    _.each(memory.sources, () => miners++);
    const flag = Memory.flags.claim;
    if(flag && flag.roomName === spawn.pos.roomName &&
        Game.rooms[flag.roomName].controller.level < 6){
        memory[remoteMiner.name] = 0;
        return
    }
    memory[remoteMiner.name] = miners;
}

function updateMineralMiner(rcl, buildings, spawn, memory) {
    memory[mineralMiner.name] = 0;
    if (rcl > 5){
        var extractor = _.find(buildings, structure => structure.structureType == STRUCTURE_EXTRACTOR);
        //Log.info(extractor)
        if(extractor) {
            var cityObject = spawn.room;
            var minerals = cityObject.find(FIND_MINERALS);
            if(spawn.room.terminal && (spawn.room.terminal.store[minerals[0].mineralType] < 6000 
                || (Game.cpu.bucket > settings_1.bucket.mineralMining && spawn.room.storage && spawn.room.storage.store[minerals[0].mineralType] < 50000))){
                memory[mineralMiner.name] = (minerals[0].mineralAmount < 1) ? 0 : 1;
            }
        }
    }
}

function updateTransporter(extensions, memory, creeps, structures, spawn) {
    if (extensions < 1 && !_.find(structures, struct => struct.structureType == STRUCTURE_CONTAINER)){
        memory[transporter.name] = 0;
    } else if (extensions < 10){
        memory[transporter.name] = 1;
    } else if(creeps.length > 8){//arbitrary 'load' on transporters
        memory[transporter.name] = settings_1.max.transporters;
    } else {
        memory[transporter.name] = 1;
    }
    scheduleIfNeeded(transporter.name, memory[transporter.name], false, spawn, creeps);
}

function updateUpgrader(city, controller, memory, rcl8, creeps, rcl) {
    const room = Game.spawns[city].room;
    memory[libz.name] = 0;//temp
    if (rcl8){
        const bucketThreshold = settings_1.bucket.upgrade + settings_1.bucket.range * cityFraction(room.name);
        const haveEnoughCpu = Game.cpu.bucket > bucketThreshold;
        if (controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[rcl]/2 
            || (controller.room.storage.store.energy > settings_1.energy.rcl8upgrade && haveEnoughCpu && settings_1.rcl8upgrade)){
            scheduleIfNeeded(libz.name, 1, true, Game.spawns[city], creeps);
        }
    } else {
        var banks = utils.getWithdrawLocations(creeps[0]);
        //Log.info(banks);
        let money = _.sum(_.map(banks, bank => bank.store[RESOURCE_ENERGY]));
        if(room.find(FIND_MY_CONSTRUCTION_SITES).length) money -= 1000;
        var capacity = _.sum(_.map(banks, bank => bank.store.getCapacity()));
        //Log.info('money: ' + money + ', ' + (100*money/capacity));
        if(!room.storage && money/capacity < 0.5){
            memory[libz.name] = 0;
            return
        }
        if(money > (capacity * .28)){
            let needed = Math.floor((money/capacity) * 5);
            if(room.storage){
                needed = Math.floor(Math.pow((money/capacity) * 4, 2));
            }
            for(let i = 0; i < needed; i++){
                spawnQueue.schedule(Game.spawns[city], libz.name, rcl >= 6);
            }
        } else if (controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[rcl]/2){
            spawnQueue.schedule(Game.spawns[city], libz.name, rcl >= 6);
        }
    }
}

function updateBuilder(rcl, memory, spawn) {
    const room = spawn.room;
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
    let totalSites;
    if (rcl < 4) {
        const repairSites = _.filter(room.find(FIND_STRUCTURES), structure => (structure.hits < (structure.hitsMax*0.3)) 
            && (structure.structureType != STRUCTURE_WALL));
        totalSites = (Math.floor((repairSites.length)/10) + constructionSites.length);
    } else {
        totalSites = constructionSites.length;
    }
    if (totalSites > 0){
        // If room is full of energy and there is contruction, make a builder
        if (room.energyAvailable == room.energyCapacityAvailable && Game.time % 500 == 0) {
            spawnQueue.schedule(spawn, builder.name);
        }
        memory[builder.name] = rcl < 6 ? settings_1.max.builders : 1;
    } else {
        memory[builder.name] = 0;
    }
    if(rcl >= 4 && Game.cpu.bucket > settings_1.bucket.repair + settings_1.bucket.range * cityFraction(room.name) && spawn.room.storage && spawn.room.storage.store[RESOURCE_ENERGY] > settings_1.energy.repair){
        const walls = _.filter(spawn.room.find(FIND_STRUCTURES), 
            struct => [STRUCTURE_RAMPART, STRUCTURE_WALL].includes(struct.structureType) 
            && !utils.isNukeRampart(struct.pos));
        if(walls.length){//find lowest hits wall
            const minHits = _.min(walls, wall => wall.hits).hits;
            if(minHits < settings_1.wallHeight[rcl - 1]){
                if(rcl >= 7 && Game.time % 500 == 0){
                    spawnQueue.schedule(spawn, builder.name, true);
                    return
                } else if(rcl <= 6){
                    memory[builder.name] = settings_1.max.builders;
                }
            }
        }
        const nukes = spawn.room.find(FIND_NUKES);
        if(nukes.length){
            const nukeStructures = _.filter(spawn.room.find(FIND_MY_STRUCTURES), struct => settings_1.nukeStructures.includes(struct.structureType));
            for(const structure of nukeStructures){
                let rampartHeightNeeded = 0;
                for(const nuke of nukes){
                    if(structure.pos.isEqualTo(nuke.pos)){
                        rampartHeightNeeded += 5000000;
                    }
                    if(structure.pos.inRangeTo(nuke.pos, 2)){
                        rampartHeightNeeded += 5000000;
                    }
                }
                if(rampartHeightNeeded == 0){
                    continue
                }
                const rampart = _.find(structure.pos.lookFor(LOOK_STRUCTURES), s => s.structureType == STRUCTURE_RAMPART);
                if(!rampart){
                    structure.pos.createConstructionSite(STRUCTURE_RAMPART);
                } else if(rampart.hits < rampartHeightNeeded + 30000){
                    spawnQueue.schedule(spawn, builder.name, rcl >= 7);
                    return
                }
            }
        }
    }
}

function updateRunner(creeps, spawn, extensions, memory, rcl, emergencyTime) {
    if (rcl == 8 && !emergencyTime) {
        memory[runner.name] = 0;
        return
    }
    var miners = _.filter(creeps, creep => creep.memory.role == remoteMiner.name && !creep.memory.link);
    const minRunners = rcl < 7 ? 2 : 0;
    var distances = _.map(miners, miner => PathFinder.search(spawn.pos, miner.pos).cost);
    let totalDistance = _.sum(distances);
    if(extensions < 10 && Game.gcl.level == 1) totalDistance = totalDistance * 1.5;//for when there are no roads
    var minerEnergyPerTick = SOURCE_ENERGY_CAPACITY/ENERGY_REGEN_TIME;
    var energyProduced = 2 * totalDistance * minerEnergyPerTick;
    var energyCarried = types.store(types.getRecipe("runner", spawn.room.energyCapacityAvailable, spawn.room));
    memory[runner.name] = Math.min(settings_1.max.runners, Math.max(Math.ceil(energyProduced / energyCarried), minRunners));
    if(rcl >= 5){
        const upgraders = _.filter(creeps, creep => creep.memory.role == libz.name).length;
        const bonusRunners = Math.floor(upgraders/3);
        memory[runner.name] += bonusRunners;
    }
    scheduleIfNeeded(runner.name, memory[runner.name], false, spawn, creeps);
}

function updateFerry(spawn, memory, rcl) {
    if (rcl >= 5) {
        memory[ferry.name] = 1;
        return
    }
    memory[ferry.name] = 0;
}

function updateStorageLink(spawn, memory, structures) {
    if(!structures.length || !Game.getObjectById(memory.storageLink)){
        memory.storageLink = null;
    }
    if(!spawn.room.storage) {
        return
    }

    const storageLink = _.find(structures, structure => structure.structureType == STRUCTURE_LINK && structure.pos.inRangeTo(spawn.room.storage.pos, 3));
    if (storageLink){
        memory.storageLink = storageLink.id;
    } else {
        memory.storageLink = null;
    }
}

function updateHighwayCreep(flagName, spawn, creeps, role) {
    const flagNames = _.filter(Object.keys(Memory.flags), flag => flag.includes(flagName));
    for(const flag of flagNames){
        const boosted = role != libb.name || Memory.flags[flag].boosted;
        scheduleIfNeeded(role, 1, boosted, spawn, creeps, flag);
    }
}

function scheduleIfNeeded(role, count, boosted, spawn, currentCreeps, flag = null) {
    const creepsInField = getCreepsByRole(currentCreeps, role);
    const creepsOnOperation = _.filter(creepsInField, creep => creep.memory.flag == flag).length;
    const queued = spawnQueue.countByInfo(spawn, role, flag);
    let creepsNeeded = count - queued - creepsOnOperation;
    while (creepsNeeded > 0) {
        spawnQueue.schedule(spawn, role, boosted, flag);
        if(role == powerMiner.name){
            spawnQueue.schedule(spawn, medic.name);
        }
        creepsNeeded--;
    }
}

function getCreepsByRole(creeps, role) {
    return _(creeps)
        .filter(creep => creep.memory.role == role)
        .value()
}

function runNuker(city){
    const flagName = city + "nuke";
    const flag = Memory.flags[flagName];
    if (flag){
        const nuker = _.find(Game.spawns[city].room.find(FIND_MY_STRUCTURES), structure => structure.structureType === STRUCTURE_NUKER);
        nuker.launchNuke(new RoomPosition(flag.x, flag.y, flag.roomName));
        delete Memory.flags[flagName];
    }
}

function setGameState(){
    if(Object.keys(Game.rooms).length == 1 && Game.gcl.level == 1){
        Memory.gameState = 0;
    } else {
        Memory.gameState = 4;
    }
}

function runEarlyGame(){
    const spawn = Object.values(Game.spawns)[0];
    const room = spawn.room;
    let role = null;
    let budget = 0;
    switch(Memory.gameState){
    case 0:
        role = runner;
        budget = 100;
        break
    case 1:
        role = remoteMiner;
        budget = 200;
        break
    case 2:
        role = runner;
        budget = 100;
        break
    case 3:
        role = libz;
        budget = 200;
        break
    }
    const name = Memory.gameState + "a";
    const recipe = types.getRecipe(role.type, budget, room, false, null);
    const result = spawn.spawnCreep(recipe, name);
    if(result == 0){
        Game.creeps[name].memory.role = role.name;
        Game.creeps[name].memory.target = role.target;
        Game.creeps[name].memory.city = room.name + "0";
        Memory.gameState++;
    }
}

function updateSpawnStress(spawn){
    const room = spawn.room;
    const memory = spawn.memory;
    if(!memory.spawnAvailability) memory.spawnAvailability = 0;
    const freeSpawns = _.filter(room.find(FIND_MY_SPAWNS), s => !s.spawning).length;
    memory.spawnAvailability = (memory.spawnAvailability * .9993) + (freeSpawns * 0.0007);
}

var city = {
    chooseClosestRoom: chooseClosestRoom,
    runCity: runCity,
    updateCountsCity: updateCountsCity,
    runTowers: runTowers,
    runPowerSpawn: runPowerSpawn,
    scheduleIfNeeded: scheduleIfNeeded,
    setGameState: setGameState,
    runEarlyGame: runEarlyGame,
};
city.chooseClosestRoom;
city.runCity;
city.updateCountsCity;
city.runTowers;
city.runPowerSpawn;
city.scheduleIfNeeded;
city.setGameState;
city.runEarlyGame;

//Borrowed from Sergey




const segmentID = 98;
const allyList = settings_1.allies;

// Priority convention:
// 1: I really need this or I'm going to die
// 0: That'd be nice I guess maybe if you really don't mind.
// Everything in between: everything in betweeen
// It's kinda important everybody has the same enums here.
const requestTypes = {
    RESOURCE: 0,
    DEFENSE: 1,
    ATTACK: 2,
    EXECUTE: 3,
    HATE: 4
};
var requestArray;


var simpleAllies = {
    // This sets foreign segments. Maybe you set them yourself for some other reason
    // Up to you to fix that.
    checkAllies() {
        if (!allyList.length) return
        // Only work 10% of the time
        if (Game.time % (10 * allyList.length) >= allyList.length) return
        const currentAllyName = allyList[Game.time % allyList.length];
        if (RawMemory.foreignSegment && RawMemory.foreignSegment.username == currentAllyName) {
            const allyRequests = JSON.parse(RawMemory.foreignSegment.data);
            //console.log(currentAllyName, RawMemory.foreignSegment.data)
            const requests = utils.getsetd(Cache, "requests", {});
            requests[currentAllyName] = [];
            if(!allyRequests){
                return
            }
            for (var request of allyRequests) {
                //const priority = Math.max(0, Math.min(1, request.priority))
                switch (request.requestType) {
                case requestTypes.ATTACK:
                    //console.log("Attack help requested!", request.roomName, priority)
                    break
                case requestTypes.DEFENSE:
                    //console.log("Defense help requested!", request.roomName, priority)
                    break
                case requestTypes.RESOURCE:
                    requests[currentAllyName].push(request);
                    // const resourceType = request.resourceType
                    // const maxAmount = request.maxAmount
                    //console.log("Resource requested!", request.roomName, request.resourceType, request.maxAmount, priority)
                    // const lowerELimit = 350000 - priority * 200000
                    // const lowerRLimit = 24000 - priority * 12000
                    break
                }
            }
        }

        const nextAllyName = allyList[(Game.time + 1) % allyList.length];
        RawMemory.setActiveForeignSegment(nextAllyName, segmentID);
    },
    // Call before making any requests
    startOfTick() {
        requestArray = [];
    },
    // Call after making all your requests
    endOfTick() {
        if (Object.keys(RawMemory.segments).length < 10) {
            RawMemory.segments[segmentID] = JSON.stringify(requestArray);
            // If you're already setting public segements somewhere this will overwrite that. You should
            // fix that yourself because I can't fix it for you.
            RawMemory.setPublicSegments([segmentID]);
        }
    },
    requestAttack(roomName, playerName, priority) {
        const request = {
            requestType: requestTypes.ATTACK,
            roomName: roomName,
            priority: priority === undefined ? 0 : priority,
            playerName: playerName
        };
        requestArray.push(request);

        if (Game.time % 10 == 0) {
            console.log(roomName, "requesting attack", "priority", priority);
        }
    },
    requestHelp(roomName, priority) {
        const request = {
            requestType: requestTypes.DEFENSE,
            roomName: roomName,
            priority: priority === undefined ? 0 : priority
        };
        requestArray.push(request);

        if (Game.time % 10 == 0) {
            console.log(roomName, "requesting help", "priority", priority);
        }
    },
    requestHate(playerName, priority) {
        const request = {
            requestType: requestTypes.HATE,
            playerName: playerName,
            priority: priority === undefined ? 0 : priority
        };
        requestArray.push(request);

        if (Game.time % 10 == 0) {
            console.log(playerName, "requesting Hait", "priority", priority);
        }
    },
    requestResource(roomName, resourceType, maxAmount, priority) {
        const request = {
            requestType: requestTypes.RESOURCE,
            resourceType: resourceType,
            maxAmount: maxAmount,
            roomName: roomName,
            priority: priority === undefined ? 0 : priority
        };
        if (Game.time % 10 == 0) {
            console.log(roomName, "requesting", resourceType, "max amount", maxAmount, "priority", priority);
        }
        requestArray.push(request);
    }
};
var swcTrading = simpleAllies;

var markets = {
    manageMarket: function(myCities){//this function is now in charge of all terminal acitivity
        if(PServ) swcTrading.checkAllies();
        if(Game.time % 10 != 0){
            return
        }
        const termCities = _.filter(myCities, c => c.terminal && Game.spawns[c.memory.city]);
        for (const city of termCities) {
            city.memory.termUsed = city.terminal.cooldown;
        }

        markets.sendCommodities(termCities);

        switch (Game.time % 1000) {
        case 0: markets.relocateBaseMins(termCities); break
        case 40: markets.distributeOps(termCities); break
        case 50: markets.distributeRepair(termCities); break
        }

        if(Game.time % 50 === 0){
            markets.distributeMinerals(termCities);
        }

        switch (Game.time % 200) {
        case 10: markets.distributePower(termCities); break
        case 20: markets.distributeUpgrade(termCities); break
        case 30: markets.buyAndSell(termCities); break
        }
    },

    ///////// TOP LEVEL MARKET FUNCTIONS (There are 9) ////////
    sendCommodities: function(cities){
        for(const city of cities) {
            const memory = Game.spawns[city.memory.city].memory;
            if(memory.ferryInfo && memory.ferryInfo.factoryInfo && memory.ferryInfo.comSend.length){
                const comSend = memory.ferryInfo.comSend[0];
                if (Memory.rooms[city.name].termUsed) {
                    return
                }

                if(city.terminal.store[comSend[0]] >= comSend[1]){
                    city.terminal.send(comSend[0], comSend[1], comSend[2]);
                    Memory.rooms[city.name].termUsed = true;
                }
                
                memory.ferryInfo.comSend = _.drop(memory.ferryInfo.comSend);
            }
        }
    },
    
    distributeEnergy: function(myCities){
        var receiver = null;
        var needEnergy = _.filter(myCities, city => city.storage && city.storage.store.energy < settings_1.energy.processPower - 250000 && city.terminal);
        if (needEnergy.length){
            var sortedCities = _.sortBy(needEnergy, city => city.storage.store.energy);
            receiver = sortedCities[0].name;
            for (const city of myCities){
                if (city.storage && city.storage.store.energy > Game.rooms[receiver].storage.store.energy + 150000){
                    const memory = Game.spawns[city.memory.city].memory;
                    if(memory.ferryInfo && memory.ferryInfo.comSend){
                        memory.ferryInfo.comSend.push([RESOURCE_ENERGY, 25000, receiver]);
                    }
                }
            }
            if(PServ){
                swcTrading.requestResource(receiver, RESOURCE_ENERGY, 100000, 0.1);
            }
        }
        if(!_.find(myCities, city => city.controller.level == 8)){
            //focus first city to rcl8
            const target = _.min(myCities, city => city.controller.progressTotal - city.controller.progress).name;
            for (const city of myCities){
                if (city.name != target && city.storage && city.storage.store.energy > Game.rooms[target].storage.store.energy - 80000){
                    const memory = Game.spawns[city.memory.city].memory;
                    if(memory.ferryInfo && memory.ferryInfo.comSend){
                        memory.ferryInfo.comSend.push([RESOURCE_ENERGY, 25000, target]);
                    }
                }
            }
            if(target && PServ && Game.rooms[target].storage && Game.rooms[target].storage.store[RESOURCE_ENERGY] < 600000){
                swcTrading.requestResource(target, RESOURCE_ENERGY, 100000, 0.2);
            }
        }
    },

    relocateBaseMins: function(myCities){
        //receivers are rooms with a lvl 0 factory
        const receivers = _.filter(myCities, city => city.terminal 
            && Game.spawns[city.memory.city].memory.ferryInfo
            && Game.spawns[city.memory.city].memory.ferryInfo.factoryInfo
            && !Game.spawns[city.memory.city].memory.ferryInfo.factoryInfo.factoryLevel && city.controller.level >= 7);
        //senders are rooms with a levelled factory, or no factory at all
        const senders = _.filter(myCities, city => city.terminal 
            && Game.spawns[city.memory.city].memory.ferryInfo
            && Game.spawns[city.memory.city].memory.ferryInfo.factoryInfo
            && (Game.spawns[city.memory.city].memory.ferryInfo.factoryInfo.factoryLevel > 0 || city.controller.level == 6));
        const baseMins = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
        const baseComs = [RESOURCE_SILICON, RESOURCE_METAL, RESOURCE_BIOMASS, RESOURCE_MIST];
        for(const sender of senders){
            //if a sender has more than 8k of a base mineral, or ANY of a base commodity, send it to a random receiver
            let go = true;
            for(const baseMin of baseMins){
                if(!go){
                    continue
                }
                if(sender.terminal.store[baseMin] > 8000 && !Memory.rooms[sender.name].termUsed){
                    const amount = sender.terminal.store[baseMin] - 8000;
                    const receiver = _.min(receivers, r => r.terminal.store[baseMin]).name;
                    sender.terminal.send(baseMin, amount, receiver);
                    Memory.rooms[sender.name].termUsed = true;
                    go = false;
                }
            }
            for(const baseCom of baseComs){
                if(!go){
                    continue
                }
                if(sender.terminal.store[baseCom] > 0 && !Memory.rooms[sender.name].termUsed){
                    const amount = sender.terminal.store[baseCom];
                    const receiver = _.find(receivers, r => !r.terminal.store[baseCom] || r.terminal.store[baseCom] < 8000);
                    if(receiver){
                        sender.terminal.send(baseCom, amount, receiver.name);
                        Memory.rooms[sender.name].termUsed = true;
                        go = false;
                    }
                }
            }
        }
        for(const receiver of receivers){
            for(const baseCom of baseComs){
                if(receiver.storage.store[baseCom] > 80000 && !Memory.rooms[receiver.name].termUsed){
                    const amount = receiver.terminal.store[baseCom];
                    const newReceiver = _.find(receivers, r => !r.terminal.store[baseCom] || r.terminal.store[baseCom] < 8000);
                    if(newReceiver){
                        receiver.terminal.send(baseCom, amount, newReceiver.name);
                        Memory.rooms[receiver.name].termUsed = true;
                        break
                    }
                }
            }
        }
    },
    
    distributeMinerals: function(myCities){
        let senders = myCities;
        for (const myCity of myCities){
            const city = myCity.memory.city;
            if(!Game.spawns[city]){
                continue
            }
            const mineral = Game.spawns[city].memory.ferryInfo && Game.spawns[city].memory.ferryInfo.mineralRequest;
            if(mineral){
                const x = senders.length;
                for (const sender of senders){
                    if(!sender.terminal){
                        continue
                    }
                    if(sender.terminal.store[mineral] >= 6000 && !Memory.rooms[sender.name].termUsed){
                        sender.terminal.send(mineral, 3000, myCity.name);
                        Memory.rooms[sender.name].termUsed = true;
                        senders = senders.splice(senders.indexOf(sender), 1);
                        Game.spawns[city].memory.ferryInfo.mineralRequest = null;
                        break
                    }
                    
                }
                if(x === senders.length && !Memory.rooms[myCity.name].termUsed){
                    const amount = 3000;
                    const goodPrice = PServ ? markets.getPrice(mineral) * 2 : markets.getPrice(mineral) * 1.2;
                    const sellOrders = markets.sortOrder(Game.market.getAllOrders(order => order.type == ORDER_SELL 
                        && order.resourceType == mineral 
                        && order.amount >= amount 
                        && (order.price < goodPrice || goodPrice == 0.002)));
                    if (sellOrders.length && sellOrders[0].price * amount <= Game.market.credits){
                        Game.market.deal(sellOrders[0].id, amount, myCity.name);
                        Game.spawns[city].memory.ferryInfo.mineralRequest = null;
                        Memory.rooms[myCity.name].termUsed = true;
                    } else {
                        const error = `Problem at distributeMinerals with ${mineral}.
                            No sell orders found with amount greater than ${amount}, price 0.5.
                            City ${myCity.name}, tick ${Game.time}`;
                        //Game.notify(error, 20)
                        console.log(error);
                    }
                }
            }
        }
    },

    distributePower: function(myCities){
        var receiver = null;
        var needPower = _.filter(myCities, city => city.controller.level > 7 && city.terminal && city.terminal.store.power < 1);
        if (needPower.length){
            receiver = needPower[0].name;
            for (const city of myCities){
                if (city.terminal && city.terminal.store.power > 2000 && !Memory.rooms[city.name].termUsed){
                    city.terminal.send(RESOURCE_POWER, 560, receiver);
                    Memory.rooms[city.name].termUsed = true;
                    Log.info("Sending power to " + receiver);
                }
            }
        }
    },

    distributeUpgrade: function(myCities){
        var receiver = null;
        var needUpgrade = _.filter(myCities, city => city.controller.level > 5 && city.terminal && city.terminal.store["XGH2O"] < 1000);
        if (needUpgrade.length){
            receiver = needUpgrade[0].name;
            for (const city of myCities){
                if (city.terminal && city.terminal.store["XGH2O"] > 7000 && !Memory.rooms[city.name].termUsed){
                    city.terminal.send("XGH2O", 3000, receiver);
                    Memory.rooms[city.name].termUsed = true;
                    Log.info("Sending upgrade boost to " + receiver);
                    return
                }
            }
        }
    },

    distributeRepair: function(myCities){
        var receiver = null;
        var needRepair = _.filter(myCities, city => city.controller.level > 5 && city.terminal && city.terminal.store["XLH2O"] < 1000);
        if (needRepair.length){
            receiver = needRepair[0].name;
            for (const city of myCities){
                if (city.terminal && city.terminal.store["XLH2O"] > 7000 && !Memory.rooms[city.name].termUsed){
                    city.terminal.send("XLH2O", 3000, receiver);
                    Memory.rooms[city.name].termUsed = true;
                    Log.info("Sending repair boost to " + receiver);
                    return
                }
            }
        }
    },

    distributeOps: function(myCities){
        var receiver = null;
        var needOps = _.filter(myCities, city => city.controller.level == 8 && city.terminal && city.terminal.store[RESOURCE_OPS] < 300);
        if (needOps.length){
            receiver = needOps[0].name;
            for (const city of myCities){
                if (city.terminal && city.terminal.store[RESOURCE_OPS] > 7000 && !Memory.rooms[city.name].termUsed){
                    city.terminal.send(RESOURCE_OPS, 5000, receiver);
                    Memory.rooms[city.name].termUsed = true;
                    Log.info("Sending power to " + receiver);
                    return
                }
            }
        }
    },

    buyAndSell: function(termCities) {
        commonjsGlobal.PIXEL = "pixel";//for p-servs
        // cancel active orders
        for(let i = 0; i < Object.keys(Game.market.orders).length; i++){
            if(!Game.market.orders[Object.keys(Game.market.orders)[i]].active){
                Game.market.cancelOrder(Object.keys(Game.market.orders)[i]);
            }
        }

        // load order info
        const orders = Game.market.getAllOrders();
        Cache.marketHistory = _.groupBy(Game.market.getHistory(), history => history.resourceType);
        const buyOrders = _.groupBy(_.filter(orders, order => order.type == ORDER_BUY), order => order.resourceType);
        //const sellOrders = _.groupBy(_.filter(orders, order => order.type == ORDER_SELL), order => order.resourceType)
        const energyOrders = markets.sortOrder(buyOrders[RESOURCE_ENERGY]).reverse();
        const highEnergyOrder = energyOrders[0];
        
        // resources we care about
        const baseMins = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
        const bars = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_GHODIUM_MELT, 
            RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER, RESOURCE_CELL, RESOURCE_WIRE, RESOURCE_ALLOY, RESOURCE_CONDENSATE];
        const highTier = commodityManager.getTopTier(commodityManager.groupByFactoryLevel(termCities)).concat([PIXEL]);
        
        markets.updateSellPoint(highTier, termCities, buyOrders);
        //markets.sellPixels(buyOrders)

        if(PServ){
            swcTrading.startOfTick();
        }
        markets.distributeEnergy(termCities);
        
        for (const city of termCities) {
            //if no terminal continue or no spawn
            if(!city.terminal || !Game.spawns[city.memory.city].memory.ferryInfo){
                continue
            }
            let termUsed = false; //only one transaction can be run using each cities terminal
            if(city.terminal.cooldown){
                termUsed = true;
            }
            if(!termUsed){
                termUsed = markets.sellOps(city, buyOrders);
            }
            const memory = Game.spawns[city.memory.city].memory;
            const level = memory.ferryInfo.factoryInfo.factoryLevel;
            //cities w/o level send all base resources to non levelled cities
            //base mins are NOT sold, they are made into bars instead.
            //bars can be sold if in excess
            //if any base mineral (besides ghodium) is low, an order for it will be placed on the market. If an order already exists, update quantity
            //if an order already exists and is above threshold (arbitrary?), increase price
            //buy minerals as needed
            if(!PServ){
                markets.buyMins(city, baseMins);
                markets.buyBoosts(city);
            } else {
                markets.requestMins(city, baseMins);
            }
            if(!level && !termUsed){
                termUsed = markets.sellResources(city, bars, 3000/*TODO make this a setting*/, city.terminal, buyOrders);
            }
            if(!termUsed){
                termUsed = markets.sellResources(city, baseMins, 20000/*TODO make this a setting*/, city.storage, buyOrders);
            }
            if(!termUsed && !settings_1.processPower){
                termUsed = markets.sellResources(city, [RESOURCE_POWER], 5000/*TODO make this a setting*/, city.terminal, buyOrders);
            }
            //buy/sell energy
            termUsed = markets.processEnergy(city, termUsed, highEnergyOrder, energyOrders);
            //sell products
            termUsed = markets.sellProducts(city, termUsed, buyOrders, highTier);

            if(PServ){
                swcTrading.endOfTick();
            }
            //termUsed = markets.buyPower(city, termUsed, sellOrders)
        }
    },

    //////////// BUY/SELL MARKET FUNCTIONS (There are 8) //////////////
    updateSellPoint: function(resources, cities, buyOrders){
        if(!Memory.sellPoint){
            Memory.sellPoint = {};
        }
        const empireStore = utils.empireStore(cities);
        for(var i = 0; i < resources.length; i++){
            if(!Memory.sellPoint[resources[i]]){
                Memory.sellPoint[resources[i]] === 0;
            }
            const orders = markets.sortOrder(buyOrders[resources[i]]).reverse();
            if(orders.length && orders[0].price > Memory.sellPoint[resources[i]]){
                //if there is a higher order than what we are willing to sell for, get pickier
                Memory.sellPoint[resources[i]] = orders[0].price;
                continue
            }
            const store = Game.resources[resources[i]] || empireStore[resources[i]];
            //otherwise, walk down sell price proportionally to how badly we need to sell
            Memory.sellPoint[resources[i]] = Memory.sellPoint[resources[i]] * (1 - (Math.pow(store, 2)/ 100000000));//100 million (subject to change)
        }
    },

    sellOps: function(city, buyOrders){
        const storage = city.storage;
        if (storage.store[RESOURCE_OPS] > 20000){
            var goodOrders = markets.sortOrder(buyOrders[RESOURCE_OPS]);
            if (goodOrders.length){
                Game.market.deal(goodOrders[goodOrders.length - 1].id, Math.min(goodOrders[goodOrders.length - 1].remainingAmount,  Math.max(0, storage.store[RESOURCE_OPS] - 20000)), city.name);
                Log.info(Math.min(goodOrders[goodOrders.length - 1].remainingAmount,  Math.max(0, storage.store[RESOURCE_OPS] - 20000)) + " " + "ops" + " sold for " + goodOrders[goodOrders.length - 1].price);
                return true
            } else {
                //make a sell order
                const orderId = _.find(Object.keys(Game.market.orders),
                    order => Game.market.orders[order].roomName === city.name && Game.market.orders[order].resourceType === RESOURCE_OPS);
                const order = Game.market.orders[orderId];
                if(!order){
                    const sellPrice = markets.getPrice(RESOURCE_OPS) * .90;
                    Game.market.createOrder({
                        type: ORDER_SELL,
                        resourceType: RESOURCE_OPS,
                        price: sellPrice,
                        totalAmount: 5000,
                        roomName: city.name   
                    });
                }
            }
        }
        return false
    },

    buyMins: function(city, minerals){
        const terminal = city.terminal;
        for(var i = 0; i < minerals.length; i++){
            const mineralAmount = terminal.store[minerals[i]];
            if(mineralAmount < 8000){
                const amountNeeded = 8000 - mineralAmount;
                const orderId = _.find(Object.keys(Game.market.orders),
                    order => Game.market.orders[order].roomName === city.name && Game.market.orders[order].resourceType === minerals[i]);
                const order = Game.market.orders[orderId];
                if(order && order.remainingAmount < amountNeeded){
                    //update order quantity
                    Game.market.extendOrder(orderId, (amountNeeded - order.remainingAmount));
                } else if(!order){
                    let buyPrice = markets.getPrice(minerals[i]);
                    buyPrice = buyPrice * 0.8;//start 20% below market value
                    Game.market.createOrder({
                        type: ORDER_BUY,
                        resourceType: minerals[i],
                        price: buyPrice,
                        totalAmount: amountNeeded,
                        roomName: city.name   
                    });
                } else if(amountNeeded === 8000 || Game.time % 400 === 30){//order already exists for max amount and has not been satisfied
                    //increment price if price is not above market value 
                    const buyPrice = markets.getPrice(minerals[i]) * 2;
                    if(order.price < buyPrice){
                        Game.market.changeOrderPrice(orderId, (Math.max(order.price*1.04, order.price + .001)));
                    }
                }
            }
        }
    },

    requestMins: function(city, minerals){
        const terminal = city.terminal;
        for(let i = 0; i < minerals.length; i++){
            const mineralAmount = terminal.store[minerals[i]];
            if(mineralAmount < 8000){
                const amountNeeded = 8000 - mineralAmount;
                swcTrading.requestResource(city.name, minerals[i], amountNeeded, (amountNeeded * amountNeeded)/64000000);
            }
        }
    },

    sellResources: function(city, resources, threshold, container, buyOrders){
        for(const resource of resources){
            if(container.store[resource] > threshold){
                const sellAmount = container.store[resource] - threshold;
                const goodOrders = markets.sortOrder(buyOrders[resource]).reverse();
                if(PServ){
                    threshold = threshold*2;
                    //distribute to allies in need
                }
                if(goodOrders.length && goodOrders[0].price > (0.50 * markets.getPrice(resource))){
                    Game.market.deal(goodOrders[0].id, Math.min(Math.min(goodOrders[0].remainingAmount,  sellAmount), city.terminal.store[resource]), city.name);
                    return true
                }
            }
        }
    },

    processEnergy: function(city, termUsed, highEnergyOrder, energyOrders){
        //can't sell if terminal has been used
        const terminal = city.terminal;
        const storage = city.storage;
        const buyThreshold = 500000;

        if(!storage){
            return termUsed
        }
        if(storage.store[RESOURCE_ENERGY] < buyThreshold && Game.market.credits > settings_1.creditMin){//buy energy with excess credits
            const orderId = _.find(Object.keys(Game.market.orders),
                order => Game.market.orders[order].roomName === city.name && Game.market.orders[order].resourceType === RESOURCE_ENERGY);
            const order = Game.market.orders[orderId];
            let highPrice = 0;
            if(highEnergyOrder){
                highPrice = highEnergyOrder.price;
            }
            if(!order){
                const buyPrice = Math.max(Math.min(markets.getPrice(RESOURCE_ENERGY), highPrice), 0.001);
                Game.market.createOrder({
                    type: ORDER_BUY,
                    resourceType: RESOURCE_ENERGY,
                    price: buyPrice,
                    totalAmount: 50000,
                    roomName: city.name   
                });
            } else {//update order occasionally
                if(order.price <= highPrice){
                    Game.market.changeOrderPrice(orderId, (Math.max(order.price*1.04, order.price + .001)));
                }
            }
        }
        if(!termUsed){//don't deal to rooms we have vision of
            if(storage.store[RESOURCE_ENERGY] > 800000){
                for(var i = 0; i < energyOrders.length; i++){
                    if(!Game.rooms[energyOrders[i].roomName]){
                        Game.market.deal(energyOrders[i].id, Math.min(energyOrders[i].remainingAmount, terminal.store.energy / 2), city.name);
                        return true
                    }
                }
            }
        }
        return termUsed
    },

    sellProducts: function(city, termUsed, buyOrders, products){
        if(termUsed){
            return termUsed
        }
        const store = city.terminal.store;
        for(var i = 0; i < products.length; i++){
            if(store[products[i]]){
                const orders = markets.sortOrder(buyOrders[products[i]]).reverse();
                if(orders.length && orders[0].price > Memory.sellPoint[products[i]] * 0.9){
                    Game.market.deal(orders[0].id, Math.min(orders[0].remainingAmount, store[products[i]]), city.name);
                    Log.info("Sold "+ products[i]+ " for: "+ orders[0].price);
                    return true
                }
            }
        }
        return false
    },

    sellPixels: function(buyOrders){
        const orders = markets.sortOrder(buyOrders[PIXEL]).reverse();
        if(orders.length && orders[0].price > Memory.sellPoint[PIXEL]){
            Game.market.deal(orders[0].id, Math.min(orders[0].remainingAmount, Game.resources[PIXEL]));
            Log.info("Sold pixels for: " + orders[0].price);
        }
    },

    buyPower: function(city, termUsed, sellOrders) {
        if (termUsed) {
            return termUsed
        }
        const store = city.terminal.store;

        // if terminal doesn't have power then buy 5000
        if (store[RESOURCE_POWER] || Game.market.credits < settings_1.creditMin) {
            return false
        }

        const orders = markets.sortOrder(sellOrders[RESOURCE_POWER]);
        if (!orders.length) {
            return false
        }
        const currentPrice = markets.getPrice(RESOURCE_POWER);
        const cheapest = orders[0];
        if (cheapest.price > currentPrice || cheapest.price > settings_1.powerPrice) {
            return false
        }

        const buyAmount = Math.min(cheapest.remainingAmount, settings_1.powerBuyVolume);
        Game.market.deal(cheapest.id, buyAmount, city.name);
        return true
    },

    buyBoosts: function(city) {
        const boosts = settings_1.civBoosts.concat(settings_1.militaryBoosts);
        for(const boost of boosts){
            if(city.terminal.store[boost] && city.terminal.store[boost] >= 3000) continue
            const amountNeeded = 6000;
            const orderId = _.find(Object.keys(Game.market.orders),
                order => Game.market.orders[order].roomName === city.name && Game.market.orders[order].resourceType === boost);
            const order = Game.market.orders[orderId];
            if(order && order.remainingAmount < amountNeeded){
                //update order quantity
                Game.market.extendOrder(orderId, (amountNeeded - order.remainingAmount));
            } else if(!order){
                let buyPrice = markets.getPrice(boost);
                buyPrice = Math.min(buyPrice * 0.8, settings_1.upgradeBoostPrice);//start 20% below market value
                Game.market.createOrder({
                    type: ORDER_BUY,
                    resourceType: boost,
                    price: buyPrice,
                    totalAmount: amountNeeded,
                    roomName: city.name   
                });
            } else if(Game.time % 800 === 30){//order already exists for max amount and has not been satisfied
                //increment price if price is not above market value 
                const buyPrice = Math.min(markets.getPrice(boost) * 2, settings_1.upgradeBoostPrice);
                if(order.price < buyPrice){
                    Game.market.changeOrderPrice(orderId, (Math.max(order.price*1.04, order.price + .001)));
                }
            }
        }
    },

    //////////////// MARKET UTILS ////////////////////
    // Sort orders from low to high
    sortOrder: function(orders) {
        const sortedOrders = _.sortBy(orders, order => order.price); 
        return sortedOrders
    },

    getPrice: function(resource){
        //determine price using history
        if(!Cache.marketHistory){
            Cache.marketHistory = _.groupBy(Game.market.getHistory(), history => history.resourceType);
        }
        const history = Cache.marketHistory[resource];
        let totalVol = 0;
        let totalPrice = 0;
        if(!history){
            return .001//min price
        }
        for(var i = 0; i < history.length; i++){
            totalVol = totalVol + history[i].volume;
            totalPrice = totalPrice + (history[i].volume * history[i].avgPrice);
        }
        const price = totalPrice/totalVol;
        return price
    }
};
var markets_1 = markets;

let usedOnStart = 0;
let enabled = false;
let depth = 0;

function setupProfiler() {
    depth = 0; // reset depth, this needs to be done each tick.
    Game.profiler = {
        stream(duration, filter) {
            setupMemory("stream", duration || 10, filter);
        },
        email(duration, filter) {
            setupMemory("email", duration || 100, filter);
        },
        profile(duration, filter) {
            setupMemory("profile", duration || 100, filter);
        },
        background(filter) {
            setupMemory("background", false, filter);
        },
        restart() {
            if (Profiler.isProfiling()) {
                const filter = Memory.profiler.filter;
                let duration = false;
                if (Memory.profiler.disableTick) {
                    // Calculate the original duration, profile is enabled on the tick after the first call,
                    // so add 1.
                    duration = Memory.profiler.disableTick - Memory.profiler.enabledTick + 1;
                }
                const type = Memory.profiler.type;
                setupMemory(type, duration, filter);
            }
        },
        reset: resetMemory,
        output: Profiler.output,
    };

    overloadCPUCalc();
}

function setupMemory(profileType, duration, filter) {
    resetMemory();
    const disableTick = Number.isInteger(duration) ? Game.time + duration : false;
    if (!Memory.profiler) {
        Memory.profiler = {
            map: {},
            totalTime: 0,
            enabledTick: Game.time + 1,
            disableTick,
            type: profileType,
            filter,
        };
    }
}

function resetMemory() {
    Memory.profiler = null;
}

function overloadCPUCalc() {
    if (Game.rooms.sim) {
        usedOnStart = 0; // This needs to be reset, but only in the sim.
        Game.cpu.getUsed = function getUsed() {
            return performance.now() - usedOnStart
        };
    }
}

function getFilter() {
    return Memory.profiler.filter
}

const functionBlackList = [
    "getUsed", // Let's avoid wrapping this... may lead to recursion issues and should be inexpensive.
    "constructor", // es6 class constructors need to be called with `new`
];

function wrapFunction(name, originalFunction) {
    if (originalFunction.profilerWrapped) { return }
    function wrappedFunction() {
        if (Profiler.isProfiling()) {
            const nameMatchesFilter = name === getFilter();
            const start = Game.cpu.getUsed();
            if (nameMatchesFilter) {
                depth++;
            }
            const result = originalFunction.apply(this, arguments);
            if (depth > 0 || !getFilter()) {
                const end = Game.cpu.getUsed();
                Profiler.record(name, end - start);
            }
            if (nameMatchesFilter) {
                depth--;
            }
            return result
        }

        return originalFunction.apply(this, arguments)
    }

    wrappedFunction.profilerWrapped = true;
    wrappedFunction.toString = () =>
        `// screeps-profiler wrapped function:\n${originalFunction.toString()}`;

    return wrappedFunction
}

function hookUpPrototypes() {
    Profiler.prototypes.forEach(proto => {
        profileObjectFunctions(proto.val, proto.name);
    });
}

function profileObjectFunctions(object, label) {
    const objectToWrap = object.prototype ? object.prototype : object;

    Object.getOwnPropertyNames(objectToWrap).forEach(functionName => {
        const extendedLabel = `${label}.${functionName}`;

        const isBlackListed = functionBlackList.indexOf(functionName) !== -1;
        if (isBlackListed) {
            return
        }

        const descriptor = Object.getOwnPropertyDescriptor(objectToWrap, functionName);
        if (!descriptor) {
            return
        }

        const hasAccessor = descriptor.get || descriptor.set;
        if (hasAccessor) {
            const configurable = descriptor.configurable;
            if (!configurable) {
                return
            }

            const profileDescriptor = {};

            if (descriptor.get) {
                const extendedLabelGet = `${extendedLabel}:get`;
                profileDescriptor.get = profileFunction(descriptor.get, extendedLabelGet);
            }

            if (descriptor.set) {
                const extendedLabelSet = `${extendedLabel}:set`;
                profileDescriptor.set = profileFunction(descriptor.set, extendedLabelSet);
            }

            Object.defineProperty(objectToWrap, functionName, profileDescriptor);
            return
        }

        const isFunction = typeof descriptor.value === "function";
        if (!isFunction) {
            return
        }
        const originalFunction = objectToWrap[functionName];
        objectToWrap[functionName] = profileFunction(originalFunction, extendedLabel);
    });

    return objectToWrap
}

function profileFunction(fn, functionName) {
    const fnName = functionName || fn.name;
    if (!fnName) {
        Log.info("Couldn't find a function name for - "+ fn);
        Log.info("Will not profile this function.");
        return fn
    }

    return wrapFunction(fnName, fn)
}

const Profiler = {
    results: {},

    printProfile() {
        // Log.info(Profiler.output())
        Profiler.output();
    },

    emailProfile() {
        Game.notify(Profiler.output(1000));
    },

    output(passedOutputLengthLimit) {
        const outputLengthLimit = passedOutputLengthLimit || 1000;
        if (!Memory.profiler || !Memory.profiler.enabledTick) {
            return "Profiler not active."
        }

        const endTick = Math.min(Memory.profiler.disableTick || Game.time, Game.time);
        const startTick = Memory.profiler.enabledTick + 1;
        const elapsedTicks = endTick - startTick;
        const header = "calls\t\ttime\t\tavg\t\tfunction";
        const footer = [
            `Avg: ${(Memory.profiler.totalTime / elapsedTicks).toFixed(2)}`,
            `Total: ${Memory.profiler.totalTime.toFixed(2)}`,
            `Ticks: ${elapsedTicks}`,
        ].join("\t");

        const lines = [header];
        let currentLength = header.length + 1 + footer.length;
        const allLines = Profiler.lines();
        let done = false;
        while (!done && allLines.length) {
            const line = allLines.shift();
            // each line added adds the line length plus a new line character.
            if (currentLength + line.length + 1 < outputLengthLimit) {
                lines.push(line);
                currentLength += line.length + 1;
            } else {
                done = true;
            }
        }
        lines.push(footer);
        return lines.join("\n")
    },

    lines() {
        const stats = Object.keys(Memory.profiler.map).map(functionName => {
            const functionCalls = Memory.profiler.map[functionName];
            return {
                name: functionName,
                calls: functionCalls.calls,
                totalTime: functionCalls.time,
                averageTime: functionCalls.time / functionCalls.calls,
            }
        }).sort((val1, val2) => {
            return val2.totalTime - val1.totalTime
        });

        Profiler.results.stats = stats;

        const lines = stats.map(data => {
            return [
                data.calls,
                data.totalTime.toFixed(1),
                data.averageTime.toFixed(3),
                data.name,
            ].join("\t\t")
        });

        return lines
    },

    prototypes: [
        { name: "Game", val: Game },
        { name: "Room", val: Room },
        { name: "Structure", val: Structure },
        { name: "Spawn", val: Spawn },
        { name: "Creep", val: Creep },
        { name: "RoomPosition", val: RoomPosition },
        { name: "Source", val: Source },
        { name: "Flag", val: Flag },
    ],

    record(functionName, time) {
        if (!Memory.profiler.map[functionName]) {
            Memory.profiler.map[functionName] = {
                time: 0,
                calls: 0,
            };
        }
        Memory.profiler.map[functionName].calls++;
        Memory.profiler.map[functionName].time += time;
    },

    endTick() {
        if (Game.time >= Memory.profiler.enabledTick) {
            const cpuUsed = Game.cpu.getUsed();
            Memory.profiler.totalTime += cpuUsed;
            Profiler.report();
        }
    },

    report() {
        if (Profiler.shouldPrint()) {
            Profiler.printProfile();
        } else if (Profiler.shouldEmail()) {
            Profiler.emailProfile();
        }
    },

    isProfiling() {
        if (!enabled || !Memory.profiler) {
            return false
        }
        return !Memory.profiler.disableTick || Game.time <= Memory.profiler.disableTick
    },

    type() {
        return Memory.profiler.type
    },

    shouldPrint() {
        const streaming = Profiler.type() === "stream";
        const profiling = Profiler.type() === "profile";
        const onEndingTick = Memory.profiler.disableTick === Game.time;
        return streaming || (profiling && onEndingTick)
    },

    shouldEmail() {
        return Profiler.type() === "email" && Memory.profiler.disableTick === Game.time
    },
};

var screepsProfiler = {
    wrap(callback) {
        if (enabled) {
            setupProfiler();
        }

        if (Profiler.isProfiling()) {
            usedOnStart = Game.cpu.getUsed();

            // Commented lines are part of an on going experiment to keep the profiler
            // performant, and measure certain types of overhead.

            // var callbackStart = Game.cpu.getUsed();
            const returnVal = callback();
            // var callbackEnd = Game.cpu.getUsed();
            Profiler.endTick();
            // var end = Game.cpu.getUsed();

            // var profilerTime = (end - start) - (callbackEnd - callbackStart);
            // var callbackTime = callbackEnd - callbackStart;
            // var unaccounted = end - profilerTime - callbackTime;
            // Log.info('total-', end, 'profiler-', profilerTime, 'callbacktime-',
            // callbackTime, 'start-', start, 'unaccounted', unaccounted);
            return returnVal
        }

        return callback()
    },

    enable() {
        enabled = true;
        hookUpPrototypes();
    },

    results: Profiler.results,

    output: Profiler.output,

    registerObject: profileObjectFunctions,
    registerFN: profileFunction,
    registerClass: profileObjectFunctions,
};

var statsLib = {
    cityCpuMap: {},

    collectStats: function(myCities) {
        for (const creep of Object.values(Game.creeps)) {
            const ccache = utils.getCreepCache(creep.id);
            const rcache = utils.getRoomCache(creep.room.name);
            if (utils.getsetd(ccache, "lastHits", creep.hits) > creep.hits) {
                ccache.attacks = utils.getsetd(ccache, "attacks", 0) + 1;
                rcache.attacks = utils.getsetd(rcache, "attacks", 0) + 1;
            }
            ccache.lastHits = creep.hits;
        }

        //stats
        if(Game.time % settings_1.statTime == 0){
            //activate segment
            RawMemory.setActiveSegments([0]);
        }
        if (Game.time % settings_1.statTime == 1){
            RawMemory.setActiveSegments([]);
            const stats = {};
            stats["cpu.getUsed"] = Game.cpu.getUsed();
            stats["cpu.bucket"] = Game.cpu.bucket;
            stats["gcl.progress"] = Game.gcl.progress;
            stats["gcl.progressTotal"] = Game.gcl.progressTotal;
            stats["gcl.level"] = Game.gcl.level;
            stats["gcl.total"] =
                GCL_MULTIPLY * Math.pow(Game.gcl.level, GCL_POW) + Game.gcl.progress;
            stats["gpl.progress"] = Game.gpl.progress;
            stats["gpl.progressTotal"] = Game.gpl.progressTotal;
            stats["gpl.level"] = Game.gpl.level;
            stats["gpl.total"] =
                POWER_LEVEL_MULTIPLY * Math.pow(Game.gpl.level, POWER_LEVEL_POW) + Game.gpl.progress;
            stats["energy"] = utils.getDropTotals();

            const heapStats = Game.cpu.getHeapStatistics();
            stats["heap.available"] = heapStats["total_available_size"];

            var cities = [];
            _.forEach(Object.keys(Game.rooms), function(roomName){
                const room = Game.rooms[roomName];
                const city = Game.rooms[roomName].memory.city;
                cities.push(city);

                if(room.controller && room.controller.my){
                    stats["cities." + city + ".rcl.level"] = room.controller.level;
                    stats["cities." + city + ".rcl.progress"] = room.controller.progress;
                    stats["cities." + city + ".rcl.progressTotal"] = room.controller.progressTotal;

                    stats["cities." + city + ".spawn.energy"] = room.energyAvailable;
                    stats["cities." + city + ".spawn.energyTotal"] = room.energyCapacityAvailable;

                    if(room.storage){
                        stats["cities." + city + ".storage.energy"] = room.storage.store.energy;
                        const factory = _.find(room.find(FIND_MY_STRUCTURES), s => s.structureType == STRUCTURE_FACTORY);
                        if(factory){
                            stats["cities." + city + ".factory.level"] = factory.level;
                            stats["cities." + city + ".factory.cooldown"] = factory.cooldown;
                        }
                    }
                    stats["cities." + city + ".cpu"] = statsLib.cityCpuMap[city];

                    // Record construction progress in the city
                    const sites = room.find(FIND_CONSTRUCTION_SITES);
                    stats[`cities.${city}.sites.progress`] =
                        _.reduce(sites, (sum, site) => sum + site.progress, 0);
                    stats[`cities.${city}.sites.progressTotal`] =
                        _.reduce(sites, (sum, site) => sum + site.progressTotal, 0);

                    // observer scans
                    const rcache = utils.getRoomCache(room.name);
                    stats[`cities.${city}.scans`] = rcache.scans || 0;
                    rcache.scans = 0;
                }

                const rcache = utils.getRoomCache(roomName);
                stats[`rooms.${roomName}.attacks`] = rcache.attacks;
                rcache.attacks = 0;
            });
            var counts = _.countBy(Game.creeps, creep => creep.memory.role);
            var creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
            var roles$1 = roles.getRoles();
            _.forEach(roles$1, function(role){
                if (counts[role.name]){
                    stats[`creeps.${role.name}.count`] = counts[role.name];
                } else {
                    stats[`creeps.${role.name}.count`] = 0;
                }

                const creeps = creepsByRole[role.name] || [];
                const attackList = _.map(creeps, creep => utils.getCreepCache(creep.id).attacks);
                stats[`creeps.${role.name}.attacks`] = _.sum(attackList);
                for (const creep of creeps) {
                    const ccache = utils.getCreepCache(creep.id);
                    ccache.attacks = 0;
                }
            });

            // City level stats
            var cityCounts = _.countBy(Game.creeps, creep => creep.memory.city);
            _.forEach(cities, function(city){
                if (!city) {
                    return
                }
                if (cityCounts[city]){
                    stats["cities." + city + ".count"] = cityCounts[city];
                } else {
                    stats["cities." + city + ".count"] = 0;
                }
                stats["cities." + city + ".deposits"] = 0;
                stats["cities." + city + ".minerals"] = 0;

                const spawn = Game.spawns[city];
                if(spawn){
                    // Record the weakest wall in each city
                    const buildings = spawn.room.find(FIND_STRUCTURES);
                    const walls = _.filter(buildings, building => building.structureType == STRUCTURE_WALL);
                    const minWall = _.min(_.toArray(_.map(walls, wall => wall.hits)));
                    stats["cities." + city + ".wall"] = walls.length  > 0 ? minWall : 0;
                }
            });

            // Mining stats
            _.forEach(Game.creeps, creep => {
                const city = creep.memory.city;
                if (creep.memory.role == depositMiner.name) {
                    stats["cities." + city + ".deposits"] += creep.memory.mined;
                    creep.memory.mined = 0;
                } else if (creep.memory.role == mineralMiner.name) {
                    stats[`cities.${city}.minerals`] += creep.memory.mined;
                    creep.memory.mined = 0;
                }
            });

            stats["market.credits"] = Game.market.credits;

            if (screepsProfiler.results && screepsProfiler.results.stats) {
                const pstats = screepsProfiler.results.stats;
                const profileSize = Math.min(settings_1.profileResultsLength, pstats.length);
                for (var i = 0; i < profileSize; i++) {
                    const result = pstats[i];
                    stats[`profiler.${result.name}.calls`] = result.calls;
                    stats[`profiler.${result.name}.time`] = result.totalTime.toFixed(1);
                }
            }
            if(Cache.bucket){
                stats["cpu.bucketfillRateMax"] = Cache.bucket.fillRate;
                stats["cpu.waste"] = Cache.bucket.waste;
                Cache.bucket.waste = 0;
            }

            // Resources
            if (Game.time % settings_1.resourceStatTime == 1) {
                const citiesWithTerminals = _.filter(myCities, c => c.terminal);
                const empireStore = utils.empireStore(citiesWithTerminals);
                for (const resource of RESOURCES_ALL) {
                    stats[`resource.${resource}`] = empireStore[resource];
                }
            }

            // Enemies
            for (const enemy in Cache.enemies) {
                stats[`enemies.${enemy}`] = Cache.enemies[enemy];
                Cache.enemies[enemy] = 0;
            }

            RawMemory.segments[0] = JSON.stringify(stats);
        }
    }
};

var stats = statsLib;

const p = {
    frequency: 2000,

    judgeNextRoom: function(){
        if(!Cache.roomData) return true
        const nextRoom = _.find(Cache.roomData, room => room.controllerPos && !room.score);
        if(nextRoom){
            const roomName = nextRoom.controllerPos.roomName;
            p.scoreRoom(roomName);
            return false
        }
        p.expand();
        return true
    },

    scoreRoom: function(roomName){
        const roomData = Cache.roomData[roomName];
        if (roomData.sourcePos.length < 2){
            roomData.score = -1;
            return
        }
        const terrain = Game.map.getRoomTerrain(roomName);
        const exits = utils.findExitPos(roomName, FIND_EXIT_TOP).concat(utils.findExitPos(roomName, FIND_EXIT_BOTTOM), utils.findExitPos(roomName, FIND_EXIT_LEFT), utils.findExitPos(roomName, FIND_EXIT_RIGHT));
        const wallMap = new PathFinder.CostMatrix;
        for(let i = 0; i < 50; i++){
            for(let j = 0; j < 50; j++){
                if(!(terrain.get(i,j) & TERRAIN_MASK_WALL) && !p.isNearExit(i, j, exits)){
                    wallMap.set(i, j, 255);
                }
            }
        }
        let level = 0;
        let changed = true;
        while(changed == true){
            changed = false;
            for(let i = 0; i < 50; i++){
                for(let j = 0; j < 50; j++){
                    if(wallMap.get(i,j) == level){
                        p.spreadWall(i, j, wallMap, level);
                        changed = true;
                    }
                }
            }
            level++;
        }
        const levelNeeded = Math.ceil(Math.max(template.dimensions.x, template.dimensions.y)/2);
        if(level - 2 < levelNeeded){
            roomData.score = -1;
            return //template won't fit
        }
        const candidates = {};
        for(let i = 0; i < 50; i++){
            for(let j = 0; j < 50; j++){
                if(wallMap.get(i,j) >= levelNeeded){
                    candidates[i * 50 + j] = {};
                }
            }
        }
        if(Object.keys(candidates).length > 1) p.narrowByControllerPos(candidates, roomData, roomName, levelNeeded);
        if(Object.keys(candidates).length > 1) p.narrowBySourcePos(candidates, roomData, roomName);

        const center = Object.values(candidates)[0];
        const centerPoint = Object.keys(candidates)[0];

        if(!center.sourceDistance){
            const sources = [new RoomPosition(roomData.sourcePos[0].x, roomData.sourcePos[0].y, roomData.sourcePos[0].roomName),
                new RoomPosition(roomData.sourcePos[1].x, roomData.sourcePos[1].y, roomData.sourcePos[1].roomName)];
            const realPos = new RoomPosition(Math.floor(centerPoint/50), centerPoint%50, roomName);
            center.sourceDistance = PathFinder.search(realPos, {pos: sources[0], range: 1}, {plainCost: 1, swampCost: 1}).cost +
                PathFinder.search(realPos, {pos: sources[1], range: 1}, {plainCost: 1, swampCost: 1}).cost;
        }
        if(!center.controllerDistance){
            const controllerPos = new RoomPosition(roomData.controllerPos.x, roomData.controllerPos.y, roomData.controllerPos.roomName);
            center.controllerDistance = PathFinder.search(new RoomPosition(Math.floor(centerPoint/50), centerPoint%50, roomName), {pos: controllerPos, range: 1}, {plainCost: 1, swampCost: 1}).cost;
        }

        const controllerScore = center.controllerDistance < levelNeeded + template.wallDistance ? 5 : Math.max(25 - center.controllerDistance, 0);
        const sourceScore = Math.max((70 - center.sourceDistance)/5, 0);
        const mineralScore = roomData.mineral == RESOURCE_CATALYST ? 5 : 0;
        roomData.score = controllerScore + sourceScore + mineralScore;
        roomData.center = centerPoint;
    },

    narrowBySourcePos: function(candidates, roomData, roomName){
        const sources = [new RoomPosition(roomData.sourcePos[0].x, roomData.sourcePos[0].y, roomData.sourcePos[0].roomName),
            new RoomPosition(roomData.sourcePos[1].x, roomData.sourcePos[1].y, roomData.sourcePos[1].roomName)];
        for(const pos of Object.keys(candidates)){
            const realPos = new RoomPosition(Math.floor(pos/50), pos%50, roomName);
            candidates[pos].sourceDistance = PathFinder.search(realPos, {pos: sources[0], range: 1}, {plainCost: 1, swampCost: 1}).cost +
                PathFinder.search(realPos, {pos: sources[1], range: 1}, {plainCost: 1, swampCost: 1}).cost;
        }
        const bestSourceDist = _.min(candidates, "sourceDistance").sourceDistance;
        for(const pos of Object.keys(candidates)){
            if(candidates[pos].sourceDistance > bestSourceDist)
                delete candidates[pos];
        }
    },

    narrowByControllerPos: function(candidates, roomData, roomName, levelNeeded){
        const controllerPos = new RoomPosition(roomData.controllerPos.x, roomData.controllerPos.y, roomData.controllerPos.roomName);
        for(const pos of Object.keys(candidates)){
            candidates[pos].controllerDistance = PathFinder.search(new RoomPosition(Math.floor(pos/50), pos%50, roomName), {pos: controllerPos, range: 1}, {plainCost: 1, swampCost: 1}).cost;
        }
        const topCandidates = _.filter(candidates, pos => pos.controllerDistance >= levelNeeded + template.wallDistance);
        if(topCandidates.length){
            for(const pos of Object.keys(candidates)){
                if(!topCandidates.includes(candidates[pos]))
                    delete candidates[pos];
            }
        }
        const bestControllerDist = _.min(candidates, "controllerDistance").controllerDistance;
        for(const pos of Object.keys(candidates)){
            if(candidates[pos].controllerDistance > bestControllerDist)
                delete candidates[pos];
        }
    },

    spreadWall: function(x, y, wallMap, level){
        const maxX = Math.min(x + 1, 49);
        const minX = Math.max(x - 1, 0);
        const maxY = Math.min(y + 1, 49);
        const minY = Math.max(y - 1, 0);
        for(let i = minX; i <= maxX; i++){
            for(let j = minY; j <= maxY; j++){
                if(wallMap.get(i, j) > level){
                    wallMap.set(i, j, level + 1);
                }
            }
        }
    },

    isNearExit: function(x ,y, exits){
        const distance = 2 + template.wallDistance;
        if((x > distance && x < 49 - distance) && (y > distance && y < 49 - distance)){
            return false
        }
        for(const exit of exits){
            if(exit.inRangeTo(x,y, distance)){
                return true
            }
        }
        return false
    },

    expand: function(){
        if(Game.cpu.bucket != 10000 || Memory.flags["claim"] || !PServ) return
        const myCities = utils.getMyCities();
        if(Game.gcl.level == myCities.length) return
        const candidates = _.reject(Cache.roomData, room => !room.score 
            || room.score == -1 
            || room.rcl 
            || room.scoutTime < Game.time + CREEP_LIFE_TIME 
            || (room.claimBlock && room.claimBlock > Game.time)
            || (room.safeModeCooldown && room.safeModeCooldown > Game.time + CREEP_LIFE_TIME));
        if(!candidates.length) return
        Log.info("attempting expansion");
        const expoRooms = _.sortBy(candidates, room => room.score);
        let expoRoomName = null;
        for(const candidate of expoRooms){
            if(expoRoomName) break
            for(const room of myCities){
                const controllerPos = new RoomPosition(candidate.controllerPos.x, candidate.controllerPos.y, candidate.controllerPos.roomName);
                const result = PathFinder.search(room.controller.pos, {pos: controllerPos, range: 1}, {
                    plainCost: 1, swampCost: 1, maxOps: 10000, roomCallback: (roomName) => {
                        if(!Cache.roomData[roomName] || (Cache.roomData.rcl && CONTROLLER_STRUCTURES[STRUCTURE_TOWER][Cache.roomData[roomName].rcl] && !settings_1.allies.includes(Cache.roomData[roomName].owner)))
                            return false
                    }
                });
                if(!result.incomplete && result.path.length < CREEP_CLAIM_LIFE_TIME){
                    expoRoomName = controllerPos.roomName;
                    break
                }
            }
        }
        if(!expoRoomName){
            Log.info("No valid rooms in range");
            return
        }
        const expoRoom = Cache.roomData[expoRoomName];
        utils.placeFlag("claim", new RoomPosition(25, 25, expoRoomName));
        utils.placeFlag("plan", new RoomPosition(Math.floor(expoRoom.center/50) - template.centerOffset.x, expoRoom.center%50 - template.centerOffset.y, expoRoomName));
    },

    searchForRemote: function(cities){
        let remote = null;
        Log.info("Searching for new remotes");
        if(!Memory.remotes) Memory.remotes = {};
        for(const city of cities){
            const result = p.findBestRemote(city);
            if(result && (!remote || result.score < remote.score))
                remote = result;
        }//result object will have roomName, score, and homeName
        if(remote){
            p.addRemote(remote.roomName, remote.homeName);
            Log.info(`Remote ${remote.roomName} added to ${remote.homeName}`);
        } else {
            Log.info("No valid remotes found");
        }
    },

    addRemote: function(roomName, homeName){
        Memory.remotes[roomName] = 1;
        Memory.spawns[homeName + "0"];
        const roomInfo = Cache.roomData[roomName];
        for(const sourceId of Object.keys(roomInfo.sources)){
            return sourceId
            //uncomment this to activate
            //memory.sources[sourceId] = roomInfo.sources[sourceId]
        }
    },

    findBestRemote: function(city) {
        let remote = null;
        const spawn = Game.spawns[city.name + "0"];
        if(!spawn) return null
        const memory = spawn.memory;
        const spawnFreeTime = memory.spawnAvailability;
        if(spawnFreeTime < settings_1.spawnFreeTime) return null
        let distance = 1;
        const roomCoords = utils.roomNameToPos(city.name);
        while(!remote){
            if(distance > 2) break
            const min = 0 - distance;
            const max = distance + 1;
            for(let i = min; i < max; i++){
                for(let j = min; j < max; j++){
                    if(j != min && j != max - 1 && i != min && i != max - 1)
                        continue
                    const roomPos = [roomCoords[0] + i, roomCoords[1] + j];
                    const roomName = utils.roomPosToName(roomPos);
                    const score = p.scoreRemoteRoom(roomName, spawn);
                    //lower score is better
                    if(score > 0 && (!remote || score < remote.score))
                        remote = {roomName: roomName, homeName: city.name, score: score};
                }
            }
            if(remote) break
            distance++;
        }
        //make sure we can afford this remote in terms of spawn time and that it is profitable
        if(remote){
            const resourcesNeeded = p.calcSpawnTimeNeeded(remote.roomName, spawn);
            const spawnTimeNeeded = resourcesNeeded.time;
            const profitMargin = resourcesNeeded.profit;
            Log.info(`Remote found at ${remote.roomName} with spawn time of ${spawnTimeNeeded} and profit of ${profitMargin}`);
            if(spawnFreeTime - spawnTimeNeeded < settings_1.spawnFreeTime || profitMargin < 0)
                return null
        }
        return remote
    },

    scoreRemoteRoom: function(roomName, spawn){
        const roomInfo = Cache.roomData[roomName];
        if(!roomInfo || roomInfo.rcl || !roomInfo.sources || !Object.keys(roomInfo.sources).length 
            || (roomInfo.safeTime && roomInfo.safeTime > Game.time)
            || Memory.remotes[roomName] || (spawn.room.energyCapacityAvailable < 2300 && !roomInfo.controllerPos)) return -1
        let totalDistance = 0;
        for(const source in roomInfo.sources){
            const sourcePos = new RoomPosition(roomInfo.sources[source].x, roomInfo.sources[source].y, roomName);
            const result = PathFinder.search(spawn.pos, {pos: sourcePos, range: 1}, {
                plainCost: 1,
                swampCost: 1,
                maxOps: 10000,
                roomCallback: function(rN){
                    const safe = Memory.remotes[rN] 
                        || (Cache.roomData[rN] && Cache.roomData[rN].owner == settings_1.username)
                        || utils.isHighway(rN)
                        || rN == roomName;
                    if(!safe) return false
                }
            });
            if(result.incomplete) return -1
            totalDistance += result.cost;
        }
        return totalDistance/Object.keys(roomInfo.sources).length
    },

    dropRemote: function(cities){
        return cities//TODO
    },

    findWorstRemote: function(city){
        return city//TODO
        //return null
    },

    calcSpawnTimeNeeded: function(roomName, spawn){
        //return 3 for invalid (no room can handle 3 spawns worth of spawn time)
        //reserver = 2 body parts every lifetime - distance from controller to spawn
        let totalTime = 0;
        let totalCost = 0;//cost per tick
        const roomInfo = Cache.roomData[roomName];
        if(roomInfo.controllerPos){
            const controllerPos = new RoomPosition(roomInfo.controllerPos.x, roomInfo.controllerPos.y, roomName);
            const path = PathFinder.search(spawn.pos, {pos: controllerPos, range: 1}, {
                plainCost: 1,
                swampCost: 1,
                maxOps: 10000
            });
            if(path.incomplete) return {profit: 0, time: 3}
            totalTime += (2 * CREEP_SPAWN_TIME)/ (CREEP_CLAIM_LIFE_TIME - path.cost);
            totalCost += types.cost([MOVE, CLAIM])/ (CREEP_CLAIM_LIFE_TIME - path.cost);
        }

        const minerBody = types.getRecipe(remoteMiner.type, spawn.room.energyCapacityAvailable, spawn.room);
        const minerCost = types.cost(minerBody);
        const minerSize = minerBody.length;   
        const runnerBody = types.getRecipe(runner.type, spawn.room.energyCapacityAvailable, spawn.room);
        const runnerCost = types.cost(runnerBody);
        const runnerSize = runnerBody.length;
        const energyCarried = types.store(runnerBody);
        const harasserBody = types.getRecipe(libb.type, spawn.room.energyCapacityAvailable, spawn.room);
        const harasserCost = types.cost(harasserBody);
        const harasserSize = harasserBody.length;
        const quadBody = types.getRecipe(quad.type, spawn.room.energyCapacityAvailable, spawn.room);
        const quadCost = types.cost(quadBody) * 4;
        const quadSize = quadBody.length * 4;
        const roadUpkeep = ROAD_DECAY_AMOUNT/ROAD_DECAY_TIME * REPAIR_COST;
        const sourceEnergy = roomInfo.controllerPos ? SOURCE_ENERGY_CAPACITY : SOURCE_ENERGY_KEEPER_CAPACITY;

        totalTime += harasserSize * CREEP_SPAWN_TIME/CREEP_LIFE_TIME;
        totalCost += harasserCost/CREEP_LIFE_TIME;

        if(!roomInfo.controllerPos){
            totalTime += quadSize * CREEP_SPAWN_TIME/(CREEP_LIFE_TIME - quadSize);//subtracting quad size to account for prespawn
            totalCost += quadCost/(CREEP_LIFE_TIME - quadSize);
        }

        for(const source in roomInfo.sources){
            const sourcePos = new RoomPosition(roomInfo.sources[source].x, roomInfo.sources[source].y, roomName);
            const result = PathFinder.search(spawn.pos, {pos: sourcePos, range: 1}, {
                plainCost: 1,
                swampCost: 1,
                maxOps: 10000
            });
            if(result.incomplete) return {profit: 0, time: 3}
            const energyProduced = 2 * result.cost * sourceEnergy/ENERGY_REGEN_TIME;
            const runnersNeeded = energyProduced / energyCarried;
            totalTime += ((minerSize * CREEP_SPAWN_TIME)/ (CREEP_LIFE_TIME - result.cost)) + (runnersNeeded * runnerSize * CREEP_SPAWN_TIME/CREEP_LIFE_TIME);
            totalCost += (minerCost/ (CREEP_LIFE_TIME - result.cost)) + (roadUpkeep * result.cost) + (runnersNeeded * runnerCost/CREEP_LIFE_TIME);
        }

        const revenue = sourceEnergy * Object.keys(roomInfo.sources).length/ENERGY_REGEN_TIME;
        const profit = revenue - totalCost;
        return {profit: profit, time: totalTime}
    },

    findRooms: function() {
        if (!p.newRoomNeeded()) {
            return
        }
        const rooms = utils.getAllRoomsInRange(10, p.roomsSelected());
        const validRooms = p.getValidRooms(rooms);
        const rankings = p.sortByScore(validRooms);
        if (rankings.length) {
            p.addRoom(rankings[0]);
        }
        return
    },

    planRooms: function() {
        // TODO

        // 1. for rooms I own. If room has a spawn or a plan, ignore. otherwise plan.
        // 2. if bucket is less than 3k, return
        // 

    },

    buildConstructionSites: function() {
        const noobMode = Game.gcl.level == 1;
        for(const roomName of Object.keys(Game.rooms)){
            const room = Game.rooms[roomName];
            if(!room.controller || !room.controller.my){
                continue
            }
            if (!room.memory.plan && Game.spawns[roomName + "0"]) {
                const spawnPos = Game.spawns[roomName + "0"].pos;
                room.memory.plan = {};
                room.memory.plan.x = spawnPos.x + template.offset.x - template.buildings.spawn.pos[0].x;
                room.memory.plan.y = spawnPos.y + template.offset.y - template.buildings.spawn.pos[0].y;
            }
            const planFlag = Memory.flags.plan;
            if(planFlag && planFlag.roomName == roomName && room.controller.owner && room.controller.owner.username == "Yoner"){
                room.memory.plan = {};
                room.memory.plan.x = planFlag.x;
                room.memory.plan.y = planFlag.y;
                delete Memory.flags.plan;
                p.clearAllStructures(room);
            }
            if (room.memory.plan) {
                var plan = room.memory.plan;
                var spawnCount = 0;
                _.forEach(template.buildings, function(locations, structureType) {
                    locations.pos.forEach(location => {
                        var pos = {"x": plan.x + location.x - template.offset.x, 
                            "y": plan.y + location.y - template.offset.y};
                        var name = roomName + spawnCount;
                        spawnCount = structureType == STRUCTURE_SPAWN ? spawnCount + 1 : spawnCount;
                        if (Game.cpu.getUsed() + 20 > Game.cpu.tickLimit) {
                            return
                        }
                        if(!noobMode || room.controller.level >= 3 || structureType != STRUCTURE_ROAD){
                            p.buildConstructionSite(room, structureType, pos, name);
                        }
                    });
                });
                if(!noobMode || room.controller.level >= 3){
                    p.buildRoads(room, plan);
                }
                if (room.controller.level >= 4 && room.storage) {
                    p.buildWalls(room, plan);
                }
                if(room.controller.level >= 5)
                    p.buildControllerLink(room);
                if (room.controller.level >= 6) {
                    p.buildExtractor(room);
                    p.buildSourceLinks(room);
                }
            }
        }
    },

    buildConstructionSite: function(room, structureType, pos, name) {
        //Log.info(room.lookAt(pos.x, pos.y)[0].type)
        if(structureType == STRUCTURE_FACTORY && PServ){
            return
        }
        if(structureType == STRUCTURE_TOWER && room.controller.safeMode > 2000){
            return
        }
        const look = room.lookAt(pos.x, pos.y);
        if(room.controller.level < 5 && room.controller.level > 1 && structureType == STRUCTURE_TERMINAL){
            structureType = STRUCTURE_CONTAINER;
        } else if(structureType == STRUCTURE_TERMINAL){
            const struct = _.find(look, object => object.type == "structure");
            if(struct && struct.structure.structureType == STRUCTURE_CONTAINER){
                struct.structure.destroy();
            }
        }
        const terrain = _.find(look, item => item.type == "terrain");
        if (terrain & TERRAIN_MASK_WALL || _.find(look, item => item.type == "structure")) 
            return
        room.createConstructionSite(pos.x, pos.y, structureType, name);
    },

    buildExtractor: function(room) {
        const minerals = room.find(FIND_MINERALS);
        if (!minerals) {
            return
        }

        const mineralPos = minerals[0].pos;
        if (mineralPos.lookFor(LOOK_STRUCTURES).length > 0) {
            return
        }

        Log.info("Building extractor: " + room.name);
        mineralPos.createConstructionSite(STRUCTURE_EXTRACTOR);
    },

    buildWalls: function(room, plan){
        //first identify all locations to be walled, if there is a road there,
        //place a rampart instead. if there is a terrain wall don't make anything
        const startX = plan.x - template.wallDistance; 
        const startY = plan.y - template.wallDistance;
        const wallSpots = [];
        for(let i = startX; i < startX + template.dimensions.x + (template.wallDistance * 2); i++){
            if(i > 0 && i < 49){
                if(startY > 0 && startY < 49){
                    wallSpots.push(new RoomPosition(i, startY, room.name));
                }
                if(startY + template.dimensions.y + (template.wallDistance * 2) - 1 > 0 && startY + template.dimensions.y + (template.wallDistance * 2) - 1 < 49){
                    wallSpots.push(new RoomPosition(i, startY + template.dimensions.y + (template.wallDistance * 2) - 1, room.name));
                }
            }
        }
        for(let i = startY; i < startY + template.dimensions.y + (template.wallDistance * 2); i++){
            if(i > 0 && i < 49){
                if(startX > 0 && startX < 49){
                    wallSpots.push(new RoomPosition(startX, i, room.name));
                }
                if(startX + template.dimensions.x + (template.wallDistance * 2) - 1 > 0 && startX + template.dimensions.x + (template.wallDistance * 2) - 1 < 49){
                    wallSpots.push(new RoomPosition(startX + template.dimensions.x + (template.wallDistance * 2) - 1, i, room.name));
                }
            }  
        }
        const terrain = new Room.Terrain(room.name);

        const costs = new PathFinder.CostMatrix();
        _.forEach(wallSpots, function(wallSpot) {//CM of just walls
            costs.set(wallSpot.x, wallSpot.y, 0xff);
        });
        room.wallCosts = costs;

        let counter = 0;
        const csites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if(csites.length){
            counter = csites.length;
        }

        for(let i = 0; i < wallSpots.length; i++){//build stuff
            if(terrain.get(wallSpots[i].x, wallSpots[i].y) === TERRAIN_MASK_WALL){
                continue
            }
            const structures = room.lookForAt(LOOK_STRUCTURES, wallSpots[i]);
            let wall = false;
            for(let j = 0; j < structures.length; j++){
                if(structures[j].structureType === STRUCTURE_WALL || structures[j].structureType === STRUCTURE_RAMPART){
                    wall = true;
                    break
                }
            }
            if(wall){
                continue
            }
            //if we make it here, no wall or rampart has been placed on this spot
            //first we will check to see if we even need a barrier
            //then, if we do need one, it'll be a ramp if structures.length, else it'll be a wall

            //check by attempting to path to all exits
            let wallNeeded = false;
            const roomExits = Object.keys(Game.map.describeExits(room.name));
            const origin = new RoomPosition(wallSpots[i].x, wallSpots[i].y, room.name);
            const searchSettings = {
                plainCost: 1,
                swampCost: 1,
                maxOps: 1000,
                maxRooms: 1,
                roomCallback: function(roomName) {
                    return Game.rooms[roomName].wallCosts
                }
            };
            for(const exitDirection of roomExits){
                const exits = room.find(parseInt(exitDirection));
                const path = PathFinder.search(origin, exits, searchSettings);
                //if path is complete, we need a wall
                if(!path.incomplete){
                    wallNeeded = true;
                    break
                }
            }
            const interiorPos = new RoomPosition(plan.x, plan.y, room.name);
            const spawnPath = PathFinder.search(origin, {pos: interiorPos, range: 1}, searchSettings);
            if(!wallNeeded || spawnPath.incomplete){
                continue
            }

            //now we need a wall
            if(structures.length || wallSpots[i].getRangeTo(room.controller) == 3){//rampart
                room.createConstructionSite(wallSpots[i], STRUCTURE_RAMPART);
                room.visual.circle(wallSpots[i], {fill: "transparent", radius: 0.25, stroke: "green"});
            } else {//wall
                room.createConstructionSite(wallSpots[i], STRUCTURE_WALL);
                room.visual.circle(wallSpots[i], {fill: "transparent", radius: 0.25, stroke: "blue"});
            }
            counter++;
            if(counter > 10){
                break
            }
        }
    },

    buildControllerLink: function(room) {
        const spawn = Game.spawns[room.name + "0"];
        if(spawn.memory.upgradeLinkPos){
            const pos = spawn.memory.upgradeLinkPos;
            p.buildConstructionSite(room, STRUCTURE_LINK, new RoomPosition(Math.floor(pos/50), pos%50, room.name));
            return
        }
        const creeps = room.controller.pos.findInRange(FIND_MY_CREEPS, 3);
        const upgrader = _.find(creeps, c => c.memory.role = libz.name);
        if(!upgrader)
            return
        let location = null;
        for(let i = upgrader.pos.x - 1; i <= upgrader.pos.x + 1; i++){
            if(location)
                break
            for(let j = upgrader.pos.y - 1; j <= upgrader.pos.y + 1; j++){
                if(upgrader.pos.isEqualTo(i,j) || i <= 2 || j <= 2)
                    continue
                const look = room.lookAt(i, j);
                let go = true;
                for(const item of look){
                    if(item.type == LOOK_STRUCTURES 
                        || (item.type == LOOK_TERRAIN && item[LOOK_TERRAIN] == "wall"))
                        go = false;
                }
                if(go){
                    location = i*50+j;
                    break 
                }
            }
        }
        if(location){
            spawn.memory.upgradeLinkPos = location;
            p.buildConstructionSite(room, STRUCTURE_LINK, new RoomPosition(Math.floor(location/50), location%50, room.name));
        } else {
            Log.info(`No link placement for controller in ${room.name}`);
        }
    },

    buildSourceLinks: function(room) {
        const sources = room.find(FIND_SOURCES);
        const spawn = Game.spawns[room.name + "0"];
        for(const source of sources){
            if(spawn.memory.sources[source.id][STRUCTURE_LINK + "Pos"]){
                const pos = spawn.memory.sources[source.id][STRUCTURE_LINK + "Pos"];
                p.buildConstructionSite(room, STRUCTURE_LINK, new RoomPosition(Math.floor(pos/50), pos%50, room.name));
                continue
            }
            const creeps = source.pos.findInRange(FIND_MY_CREEPS, 1);
            const miner = _.find(creeps, c => c.memory.source = source.id);
            if(!miner)
                continue
            let location = null;
            for(let i = miner.pos.x - 1; i <= miner.pos.x + 1; i++){
                if(location)
                    break
                for(let j = miner.pos.y - 1; j <= miner.pos.y + 1; j++){
                    if(miner.pos.isEqualTo(i,j) || i <= 2 || j <= 2)
                        continue
                    const look = room.lookAt(i, j);
                    let go = true;
                    for(const item of look){
                        if(item.type == LOOK_STRUCTURES 
                            || (item.type == LOOK_CREEPS && item[LOOK_CREEPS].memory.role == remoteMiner.name)
                            || (item.type == LOOK_TERRAIN && item[LOOK_TERRAIN] == "wall"))
                            go = false;
                    }
                    if(go){
                        location = i*50+j;
                        break 
                    } 
                }
            }
            if(location){
                spawn.memory.sources[source.id][STRUCTURE_LINK + "Pos"] = location;
                p.buildConstructionSite(room, STRUCTURE_LINK, new RoomPosition(Math.floor(location/50), location%50, room.name));
            } else {
                Log.info(`No link placement for source at ${source.pos}`);
            }
        }
    },

    makeRoadMatrix: function(room, plan){
        const costs = new PathFinder.CostMatrix();
        if(plan){
            _.forEach(template.buildings, function(locations, structureType) {//don't make roads anywhere that a structure needs to go
                locations.pos.forEach(location => {
                    var pos = {"x": plan.x + location.x - template.offset.x, 
                        "y": plan.y + location.y - template.offset.y};
                    if(structureType !== STRUCTURE_ROAD){
                        costs.set(pos.x, pos.y, 0xff);
                    }
                });
            });
        } 
        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                        (struct.structureType !== STRUCTURE_WALL) && //allow roads on walls so that path to controller still works
                         (struct.structureType !== STRUCTURE_RAMPART)) {
                // Can't walk through non-walkable buildings
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            } else if(!struct.my){//allow roads on walls so that path to controller still works
                costs.set(struct.pos.x, struct.pos.y, 5);
            }
        });
        room.find(FIND_MY_CONSTRUCTION_SITES).forEach(function(site) {
            if (site.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(site.pos.x, site.pos.y, 1);
            }
        });
        return costs
    },

    getSourcePaths: function(room, exits, roadMatrix){
        const sources = Object.keys(Game.spawns[room.memory.city].memory.sources).reverse();
        const sourcePaths = [];
        for (let i = 0; i < sources.length; i++) {
            const source = Game.getObjectById(sources[i]);
            if(!source) continue
            const sourcePos = Game.getObjectById(sources[i]).pos;
            const sourcePath = PathFinder.search(sourcePos, exits, {
                plainCost: 4, swampCost: 5, maxRooms: 1, 
                roomCallback: function(roomName){
                    if(roomName == room.name)
                        return roadMatrix
                    if(Game.rooms[roomName]){
                        return p.makeRoadMatrix(Game.rooms[roomName], Game.rooms[roomName].memory.plan)
                    }
                }
            });
            for(var j = 0; j < sourcePath.path.length; j++){
                sourcePaths.push(sourcePath.path[j]);
            }
        }
        return sourcePaths.reverse()
    },

    getMineralPath: function(room, exits, roadMatrix){
        const mineralPos = room.find(FIND_MINERALS)[0].pos;
        const mineralPath = PathFinder.search(mineralPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        });
        return mineralPath.path.reverse()
    },

    getControllerPath: function(room, exits, roadMatrix){
        const path = [];
        const structures = room.find(FIND_MY_STRUCTURES);
        const controller = _.find(structures, structure => structure.structureType === STRUCTURE_CONTROLLER);
        const controllerPos = controller.pos;
        const controllerPath = PathFinder.search(controllerPos, exits, {
            plainCost: 4, swampCost: 4, maxRooms: 1, 
            roomCallback: () => roadMatrix
        });
        for(var i = 2; i < controllerPath.path.length; i++){// don't include first two paths (not needed)
            path.push(controllerPath.path[i]);
        } 
        return path.reverse()
    },

    getExitPaths: function(room, exits, plan, roadMatrix){
        const roomExits = Object.keys(Game.map.describeExits(room.name));
        const path = [];

        const startPoint = template.buildings.storage.pos[0];
        const startPos = new RoomPosition(plan.x + startPoint.x - template.offset.x, plan.y + startPoint.y - template.offset.y, room.name);
        for(const exitDirection of roomExits){
            const exitSpots = room.find(parseInt(exitDirection));
            const exitPath0 = PathFinder.search(startPos, exitSpots, {
                plainCost: 4, swampCost: 4, maxRooms: 1, 
                roomCallback: () => roadMatrix
            });
            const exitPoint = exitPath0.path[exitPath0.path.length - 1];
            //now path from this point to template exits
            const exitPath = PathFinder.search(exitPoint, exits, {
                plainCost: 4, swampCost: 4, maxRooms: 1, 
                roomCallback: () => roadMatrix
            });
            const exitPathPath = exitPath.path;
            exitPathPath.reverse();
            const safeZoneDimensions = {
                "x": [plan.x - template.wallDistance, plan.x + template.dimensions.x + template.wallDistance - 1],
                "y": [plan.y - template.wallDistance, plan.y + template.dimensions.y + template.wallDistance - 1]
            };
            for(const pathPoint of exitPathPath){
                if(pathPoint.x < safeZoneDimensions.x[0] 
                    || pathPoint.x > safeZoneDimensions.x[1]
                    || pathPoint.y < safeZoneDimensions.y[0]
                    || pathPoint.y > safeZoneDimensions.y[1]){
                    break
                }
                path.push(pathPoint);
            }
        }
        return path
    },

    compileRoads: function(a, b, c, d){
        return a.concat(b, c, d)
    },

    buildRoads: function(room, plan){
        //need roads to sources, mineral, controller (3 spaces away), exits (nearest exit point for each)
        if(!(room.memory.city && Game.spawns[room.memory.city] && Game.spawns[room.memory.city].memory.sources)){
            return
        }
        const exits = [];
        for(let i = 0; i < template.exits.length; i++){
            const posX = plan.x + template.exits[i].x - template.offset.x;
            const posY = plan.y + template.exits[i].y - template.offset.y;
            const roomPos = new RoomPosition(posX, posY, room.name);
            exits.push(roomPos);
        }//exits now filled with roomPos of all exits from template

        //generateCM
        const roadMatrix = p.makeRoadMatrix(room, plan);

        //roads from sources
        const sourcePaths = p.getSourcePaths(room, exits, roadMatrix);

        //road from mineral
        const mineralPath = p.getMineralPath(room, exits, roadMatrix);

        //road from controller
        const controllerPath = p.getControllerPath(room, exits, roadMatrix);

        //roads from exits
        const exitPaths = p.getExitPaths(room, exits, plan, roadMatrix);

        //push all paths onto big list
        const roads = p.compileRoads(controllerPath, sourcePaths, mineralPath, exitPaths);
        
        //place Csites
        let counter = 0;
        const csites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if(csites.length){
            counter = csites.length;
        }
        for(let i = 0; i < roads.length; i++){
            new RoomVisual(roads[i].roomName).circle(roads[i], {fill: "#ff1111", radius: 0.1, stroke: "red"});
            if(counter < 20){//doesn't update during the tick
                const look = room.lookForAt(LOOK_STRUCTURES, roads[i]);
                if(look.length){
                    if(look[0].structureType != STRUCTURE_RAMPART){
                        continue
                    }
                }
                if(!roads[i].createConstructionSite(STRUCTURE_ROAD)){
                    counter++;
                }
            }
        }
        //TODO: cut this function up, plan and build walls + ramparts, limit number of roads total using static or global, make this happen less frequently
    },

    clearAllStructures: function(room) {
        const structures = room.find(FIND_STRUCTURES);
        _.forEach(structures, structure => {
            if(!structure.my){
                structure.destroy();
            }
        });
    },

    planRoom: function(roomName) {
        const ter = Game.map.getRoomTerrain(roomName);
        const sqd = _(Array(50)).map((r, i) => { 
            return _(Array(50))
                .map((v, j) => ter.get(i, j) == TERRAIN_MASK_WALL ? 0 : Infinity)
                .value()
        }).value();
        const b = 4; // buffer
        const r = 50; // room size
        const min = b; 
        const max = r - b - 1;

        for (let i = min; i <= max; i++) {
            for (let j = min; j <= max; j++) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i - 1][j] + 1, sqd[i - 1][j - 1] + 1);     
            }
        }
        
        for (let i = max; i >= min; i--) {
            for (let j = min; j <= max; j++) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i][j - 1] + 1, sqd[i + 1][j - 1] + 1);
            }
        }
        
        for (let i = max; i >= min; i--) {
            for (let j = max; j >= min; j--) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i + 1][j] + 1, sqd[i + 1][j + 1] + 1);
            }
        }
        
        for (let i = min; i <= max; i++) {
            for (let j = max; j >= min; j--) {
                sqd[i][j] = Math.min(sqd[i][j], sqd[i][j + 1] + 1, sqd[i - 1][j + 1] + 1);
            }
        }

        return _(sqd).find(row => _(row).find(score => score >= 7))
    },

    newRoomNeeded: function() {    
        return (Game.time % p.frequency === 0) &&
            (Game.gcl.level > p.roomsSelected.length) &&
            p.hasCpu() &&
            p.totalEnergy() > 200000 &&
            p.isRcl4() &&
            p.myRooms().length === p.roomsSelected().length
    },

    getValidRooms: function(rooms) {
        return _.filter(rooms, p.isValidRoom)
    },

    isValidRoom: function(roomName) {
        if (!Game.map.isRoomAvailable(roomName)) return false
        return false
    },

    sortByScore: function(rooms) {
        return rooms // TODO
    },

    addRoom: function(room) {
        const selected = p.roomsSelected();
        selected.push(room.name);
    },

    roomsSelected: function() {
        let selected = Memory.rooms.selected;
        if (!selected) {
            selected = p.myRoomNames();
            Memory.rooms.selected = selected;
        }
        return selected
    },

    isRcl4: function() {
        const rooms = p.myRooms();
        const rcls = _.map(rooms, (room) => room.controller.level);
        return _.max(rcls) >= 4
    },

    totalEnergy: function() {
        const rooms = p.myRooms();
        const energy = _.map(rooms, p.getStorageEnergy);
        return _.sum(energy)
    },

    getStorageEnergy: function(room) {
        return room.storage ? room.storage.store.energy : 0
    },

    myRooms: function() {
        return _.filter(Game.rooms, (room) => utils.iOwn(room.name))
    },

    myRoomNames: function() {
        return _.map(p.myRooms(), (room) => room.name)
    },

    hasCpu: function () {
        const used = Memory.stats["cpu.getUsed"];
        return (used !== undefined) && (used < Game.cpu.tickLimit / 2)
    }
};

var roomplan = p;

const ob = {
    run: function(city){
        const roomName = city.substring(0, city.length - 1);
        const rcache = utils.getRoomCache(roomName);
        rcache.scanned = false;

        const remainder = Game.time % settings_1.observerFrequency;
        if(remainder == 0){
            ob.observeNewRoomForMining(city);
        } else if (remainder == 1){
            ob.placeMiningFlags(city);
        }
    },

    scanRoom: function() {
        const observer = ob.getUnusedObserver();
        if (!observer) return false

        ob.scanNextRoom(observer);
        return true
    },

    recordRoomData: function() {
        const roomsToScan = Cache["roomsToScan"];
        if(!roomsToScan){
            return
        }
        const roomDataCache = utils.getsetd(Cache, "roomData", {});
        for(const room in Game.rooms){
            if(roomsToScan.has(room)){
                const roomData = utils.getsetd(roomDataCache, room, {});
                ob.recordData(room, roomData);
                roomsToScan.delete(room);
            }
        }
    },

    recordData: function(roomName, roomData) {
        const room = Game.rooms[roomName];
        if (!room) { // We don't have vision for some reason
            return
        }
        if(room.controller){
            roomData.safeModeCooldown = room.controller.safeModeCooldown && (Game.time + room.controller.safeModeCooldown) || 0;
            roomData.owner = room.controller.owner && room.controller.owner.username;
            roomData.rcl = (room.controller.level) || 0;
            roomData.controllerPos = room.controller.pos;
            roomData.sourcePos = room.find(FIND_SOURCES).map(source => source.pos);
            roomData.mineral = room.find(FIND_MINERALS)[0].mineralType;
            if(room.controller.safeMode){
                roomData.smEndTick = room.controller.safeMode + Game.time;
            }
        }
        const sources = room.find(FIND_SOURCES);
        roomData.sources = {};
        for(const source of sources){
            roomData.sources[source.id] = source.pos;
        }
        const skLairs = _.filter(room.find(FIND_HOSTILE_STRUCTURES), struct => struct.structureType == STRUCTURE_KEEPER_LAIR);
        if(skLairs && skLairs.length){
            roomData.skLairs = skLairs.map(lair => lair.pos);
            const core = _.find(room.find(FIND_HOSTILE_STRUCTURES), struct => struct.structureType == STRUCTURE_INVADER_CORE);
            roomData.rcl = core ? core.level : 0;
        }
        const scoutTime = room.controller ? settings_1.scouting.controllerRoom[roomData.rcl] :
            skLairs && skLairs.length ? settings_1.scouting.sk :
                settings_1.scouting.highway;
        roomData.scoutTime = Game.time + scoutTime;
    },

    getUnusedObserver: function() {
        const obsCity = _.find(utils.getMyCities(), city => !utils.getRoomCache(city.name).scanned 
            && utils.getRoomCache(city.name).scannerTargets 
            && utils.getRoomCache(city.name).scannerTargets.length
            && _.find(city.find(FIND_MY_STRUCTURES), struct => struct.structureType == STRUCTURE_OBSERVER));
        return obsCity && _.find(obsCity.find(FIND_MY_STRUCTURES), struct => struct.structureType == STRUCTURE_OBSERVER)
    },

    scanNextRoom: function(observer) {
        const target = ob.getScannerTarget(observer);
        observer.observeRoom(target);

        const rcache = utils.getRoomCache(observer.room.name);
        rcache.scanned = true; // flag scanner as used
        rcache.scans = (rcache.scans || 0) + 1;  // Record stats for scans
    },

    getScannerTarget: function(observer) {
        const rcache = utils.getRoomCache(observer.room.name);
        if (!rcache.scannerTargets) {
            ob.findRoomsForScan();
        }
        return rcache.scannerTargets.shift()
    },

    findRoomsForScan: function() {
        let roomList = [];
        const cities = _.filter(utils.getMyCities(), c => c.controller.level >= 4);
        const lowLevel = _.filter(utils.getMyCities(), c => c.controller.level < 4 && c.energyCapacityAvailable >= 550);
        for(const city of lowLevel){
            const roomPos = utils.roomNameToPos(city.name);
            roomList = roomList.concat(utils.generateRoomList(roomPos[0] - 1, roomPos[1] - 1, 3, 3));//3 by 3
        }
        for(const city of cities){
            const roomPos = utils.roomNameToPos(city.name);
            roomList = roomList.concat(utils.generateRoomList(roomPos[0] - OBSERVER_RANGE, roomPos[1] - OBSERVER_RANGE, (OBSERVER_RANGE*2) + 1, (OBSERVER_RANGE*2) + 1));//21 by 21
        }
        const roomsToScan = new Set(roomList);
        const roomDataCache = utils.getsetd(Cache, "roomData", {});
        for(const roomName of roomsToScan){
            const roomData = utils.getsetd(roomDataCache, roomName, {});
            if(Game.map.getRoomStatus(roomName).status != "normal" || roomData.scoutTime && roomData.scoutTime > Game.time){
                roomsToScan.delete(roomName);
                continue
            }
            const obsRoom = _.find(cities, city => city.controller.level == 8 && Game.map.getRoomLinearDistance(roomName, city.name) <= OBSERVER_RANGE);
            if(obsRoom){
                const rcache = utils.getRoomCache(obsRoom.name);
                const targets = utils.getsetd(rcache, "scannerTargets", []);
                targets.push(roomName);
                continue
            }
            //if no rooms have an obs in range, we'll need a nearby room to send a scout
            const scoutRooms = _.filter(cities.concat(lowLevel), city => (city.controller.level >= 2 && Game.map.getRoomLinearDistance(roomName, city.name) <= OBSERVER_RANGE)
                || Game.map.getRoomLinearDistance(roomName, city.name) <= 1);
            const scoutRoom = _.min(scoutRooms, city => Game.map.getRoomLinearDistance(roomName, city.name));
            const rcache = utils.getRoomCache(scoutRoom.name);
            const targets = utils.getsetd(rcache, "scannerTargets", []);
            targets.push(roomName);
        }
        Cache["roomsToScan"] = roomsToScan;
    },
    
    observeNewRoomForMining: function(city) {
        const obs = ob.getObsForMining(city);
        if (!obs) return false
        ob.preparePowerRoomsList(city, settings_1.miningRange);
        const roomNum = ob.timeToRoomNum(Game.time, city);
        //scan next room
        obs.observeRoom(Game.spawns[city].memory.powerRooms[roomNum]);
        const rcache = utils.getRoomCache(obs.room.name);
        rcache.scanned = true;
    },

    placeMiningFlags: function(city) {
        const obs = ob.getObsForMining(city);
        if (!obs || !Game.spawns[city].memory.powerRooms.length) return false

        const roomNum = ob.timeToRoomNum(Game.time - 1, city);
        const roomName = Game.spawns[city].memory.powerRooms[roomNum];
        if(!Game.rooms[roomName]){//early return if room wasn't scanned
            return
        }
        if (Game.rooms[roomName].controller){
            Game.spawns[city].memory.powerRooms.splice(roomNum, 1);
            return
        }
        const structures = Game.rooms[roomName].find(FIND_STRUCTURES);
        var modifier = (Math.random() ** (1/4)) * settings_1.bucket.range;
        if (Game.map.getRoomLinearDistance(Game.spawns[city].room.name, roomName) <= settings_1.powerMiningRange && Game.cpu.bucket >= settings_1.bucket.powerMining + modifier - (settings_1.bucket.range/2)) {
            ob.flagPowerBanks(structures, city, roomName);
        }
        if (Game.cpu.bucket >= settings_1.bucket.resourceMining) {
            ob.flagDeposits(structures, city, roomName);
        }
    },

    timeToRoomNum: function(time, city) {
        return Math.floor(time / settings_1.observerFrequency) % Game.spawns[city].memory.powerRooms.length    
    },

    getObsForMining: function(city) {
        if((!Game.spawns[city]) || settings_1.miningDisabled.includes(city)){
            return false
        }
        const buildings = Game.spawns[city].room.find(FIND_MY_STRUCTURES);
        return _.find(buildings, structure => structure.structureType === STRUCTURE_OBSERVER)
    },

    preparePowerRoomsList: function(city, range) {
        if (Game.spawns[city].memory.powerRooms) {
            return
        }
        Game.spawns[city].memory.powerRooms = [];
        const myRoom = Game.spawns[city].room.name;
        const pos = utils.roomNameToPos(myRoom);
        for (let i = -range; i < +range; i++){
            const jRange = range - Math.abs(i);
            for (let j = -jRange; j < +jRange; j++){
                const coord = [pos[0] + i, pos[1] + j];
                const roomName = utils.roomPosToName(coord);
                if (utils.isHighway(roomName)) {
                    Game.spawns[city].memory.powerRooms.push(roomName);
                }
            }
        }
    },

    flagPowerBanks: function(structures, city, roomName) {
        const powerBank = _.find(structures, structure => structure.structureType === STRUCTURE_POWER_BANK);
        const flagName = utils.generateFlagName(city + "powerMine");
        if (powerBank && powerBank.power > 1500 && powerBank.ticksToDecay > 2800 &&
                structures.length < 30 && Game.spawns[city].room.storage.store.energy > settings_1.energy.powerMine){
            const terrain = Game.rooms[roomName].getTerrain();
            if (!ob.isBlockedByWalls(terrain, powerBank.pos) && !ob.checkFlags(powerBank.pos)) {
                utils.placeFlag(flagName, powerBank.pos, Game.time + powerBank.ticksToDecay);
                Log.info("Power Bank found in: " + roomName);
            }
        }
    },

    flagDeposits: function(structures, city, roomName) {
        //flag deposits
        if (structures.length >= 30) {
            return false
        }

        const deposits = Game.rooms[roomName].find(FIND_DEPOSITS);
        if (!deposits.length) {
            return false
        }

        for (let i = 0; i < deposits.length; i++) {
            const depositFlagName = utils.generateFlagName(city + "deposit");
            if(deposits[i].lastCooldown < 5 && !ob.checkFlags(deposits[i].pos)){
                utils.placeFlag(depositFlagName, deposits[i].pos, Game.time + settings_1.depositFlagRemoveTime);
                Memory.flags[depositFlagName] = deposits[i].pos;
                Memory.flags[depositFlagName].harvested = Math.floor(Math.pow((deposits[i].lastCooldown / 0.001), 1/1.2));
            }
        }
    },

    checkFlags: function(roomPos){
        const flags = Object.keys(Memory.flags);
        return _(flags).find(flagName => {
            const flag = Memory.flags[flagName];
            const flagPos = new RoomPosition(flag.x, flag.y, flag.roomName);
            return flagPos.isEqualTo(roomPos)
        })
    },

    // True if a point is surrounded by terrain walls
    isBlockedByWalls: function(terrain, pos) {
        let walls = 0;
        for(let i = -1; i <= +1; i++){
            for (let j = -1; j <= +1; j++){
                const result = terrain.get(pos.x + i, pos.y + j);
                if (result == TERRAIN_MASK_WALL){
                    walls++;
                }
            }
        }
        return walls >= 8
    }
};

var observer = ob;

const b = {
    SIZE: 10000, // 10K constant cpu bucket size

    manage: function() {
        Memory.avgCpu = Memory.avgCpu ? (Memory.avgCpu * .999) + (Game.cpu.getUsed() * .001): Game.cpu.limit;
        if(Game.time % 1000 == 2){
            const cities = utils.getMyCities();
            if(Memory.avgCpu/Game.cpu.limit > settings_1.dropRemote)
                roomplan.dropRemote(cities);
            if(Memory.avgCpu/Game.cpu.limit < settings_1.addRemote)
                roomplan.searchForRemote(cities);
        }
        if (b.growingTooQuickly()) {
            const wasteAmount = Game.cpu.bucket == b.SIZE ? 50 : 1;
            b.wasteCpu(wasteAmount);
        }
    },

    growingTooQuickly: function() {
        Cache.bucket = Cache.bucket || {};
        Cache.bucket.waste = Cache.bucket.waste || 0;
        const oldBucket = Cache.bucket.amount;
        const newBucket = Game.cpu.bucket;
        Cache.bucket.amount = newBucket;

        if (!oldBucket) return false
        const delta = newBucket - oldBucket;
        const oldRate = Cache.bucket.fillRate || 0;
        Cache.bucket.fillRate = 0.99 * oldRate + 0.01 * delta;

        const percentEmpty = 1 - Game.cpu.bucket / b.SIZE;
        return (Cache.bucket.fillRate > percentEmpty * settings_1.bucket.growthLimit || Game.cpu.bucket == b.SIZE)
    },

    wasteCpu: function(amount) {
        Cache.bucket.waste += Math.max(Game.cpu.limit + amount - Game.cpu.getUsed(), 0);
        let spawnedScouts = false;
        while (Game.cpu.getUsed() < Game.cpu.limit + amount) {
            //military.attack()
            if(!observer.scanRoom()){
                if(!spawnedScouts){
                    b.spawnScouts();
                    spawnedScouts = true;
                }
                if(roomplan.judgeNextRoom()) break
            }
        }
    },

    spawnScouts: function(){
        if(Game.time % 500 != 0) return
        const cities = utils.getMyCities();
        const rcl8 = _.find(cities, city => city.controller.level == 8);
        if(!rcl8) observer.findRoomsForScan();
        for(const city of cities){
            if(city.controller.level < 8){
                const rcache = utils.getRoomCache(city.name);
                const targets = utils.getsetd(rcache, "scannerTargets", []);
                if(targets.length){
                    const spawn = Game.spawns[city.memory.city];
                    if(spawn)
                        spawnQueue.schedule(spawn, scout.name);
                }
            }
        }
    }
};
var bucket = b;

screepsProfiler.registerObject(actions_1, "actions");
screepsProfiler.registerObject(breaker, "breaker");
screepsProfiler.registerObject(builder, "builder");
screepsProfiler.registerObject(city, "city");
screepsProfiler.registerObject(claimer, "claimer");
screepsProfiler.registerObject(commodityManager, "commodityManager");
screepsProfiler.registerObject(defender, "defender");
screepsProfiler.registerObject(depositMiner, "depositMiner");
screepsProfiler.registerObject(error_1, "error");
screepsProfiler.registerObject(factory, "factory");
screepsProfiler.registerObject(ferry, "ferry");
screepsProfiler.registerObject(libb, "harasser");
screepsProfiler.registerObject(labs_1, "labs");
screepsProfiler.registerObject(link, "link");
screepsProfiler.registerObject(markets_1, "markets");
screepsProfiler.registerObject(medic, "medic");
screepsProfiler.registerObject(mineralMiner, "mineralMiner");
screepsProfiler.registerObject(observer, "observer");
screepsProfiler.registerObject(powerCreep, "powerCreep");
screepsProfiler.registerObject(powerMiner, "powerMiner");
screepsProfiler.registerObject(quad, "quad");
screepsProfiler.registerObject(remoteMiner, "remoteMiner");
screepsProfiler.registerObject(robber, "robber");
screepsProfiler.registerObject(roles, "roles");
screepsProfiler.registerObject(roomplan, "roomplan");
screepsProfiler.registerObject(runner, "runner");
screepsProfiler.registerObject(settings_1, "settings");
screepsProfiler.registerObject(spawnBuilder, "spawnBuilder");
screepsProfiler.registerObject(spawnQueue, "spawnQueue");
screepsProfiler.registerObject(stats, "stats");
screepsProfiler.registerObject(template, "template");
screepsProfiler.registerObject(tower, "tower");
screepsProfiler.registerObject(transporter, "transporter");
screepsProfiler.registerObject(types, "types");
screepsProfiler.registerObject(unclaimer, "unclaimer");
screepsProfiler.registerObject(libz, "upgrader");
screepsProfiler.registerObject(utils, "utils");

commonjsGlobal.Tmp = {};
commonjsGlobal.T = function() { return `Time: ${Game.time}` };
commonjsGlobal.Cache = {};
commonjsGlobal.Log = {};
Log.info = function(text) { console.log(`<p style="color:yellow">[INFO] ${Game.time}: ${text}</p>`); };
Log.error = function(text) { console.log(`<p style="color:red">[ERROR] ${Game.time}: ${text}</p>`); };

// Function to buy sub token. Price in millions. BuyToken(3) will pay 3 million
commonjsGlobal.BuyToken = function(price) {
    Game.market.createOrder({
        type: ORDER_BUY,
        resourceType: SUBSCRIPTION_TOKEN,
        price: price * 1e6,
        totalAmount: 1,
        roomName: "E11S22"
    });
};
commonjsGlobal.SpawnQuad = function(city, boosted){
    military.spawnQuad(city, boosted);
};
commonjsGlobal.SpawnBreaker = function(city, boosted){
    spawnQueue.initialize(Game.spawns[city]);
    spawnQueue.schedule(Game.spawns[city], "medic", boosted);
    spawnQueue.schedule(Game.spawns[city], "breaker", boosted);
};
commonjsGlobal.SpawnRole = function(role, city, boosted){
    spawnQueue.initialize(Game.spawns[city]);
    spawnQueue.schedule(Game.spawns[city], role, boosted);
};
commonjsGlobal.PlaceFlag = function(flagName, x, y, roomName, duration){
    Memory.flags[flagName] = new RoomPosition(x, y, roomName);
    Memory.flags[flagName].removeTime = Game.time + (duration || 20000);
};

commonjsGlobal.DeployQuad = function(roomName, boosted) {
    military.deployQuad(roomName, boosted);
};

commonjsGlobal.RoomWeights = function(roomName) {
    roomplan.planRoom(roomName);
};

commonjsGlobal.PServ = (!Game.shard.name.includes("shard") || Game.shard.name == "shardSeason");

commonjsGlobal.RequestResource = function(roomName, resourceType, maxAmount, priority) {
    swcTrading.startOfTick();
    swcTrading.requestResource(roomName, resourceType, maxAmount, priority);
    swcTrading.endOfTick();
};
commonjsGlobal.PCAssign = function(name, city, shard){
    const creep = Game.powerCreeps[name];
    if(!creep){
        Log.error("invalid PC name");
    }
    creep.memory.city = city;
    creep.memory.shard = shard || Game.shard;
    Log.info(`${name} has been assigned to ${city} on ${creep.memory.shard}`);
};

//Code to manually profile:
//Game.profiler.profile(1000);
//Game.profiler.output();

//Code to claim a new room:
//Memory.flags["W11N190break"] = new RoomPosition(25,25,"W16N21")
//Memory.flags["claim"] = new RoomPosition(25,25,"W16N21")
//Memory.flags["plan"] = new RoomPosition(30,33,"W16N21")

//  Resources/CPU    | Buying Price (CR) | Selling Price (CR)
//   250 energy      |    20   CR        |   10 CR
//   1.6 commodities |    25   CR        |   25   CR
//   .85 power       |    3.45 CR        |   3.45 CR

// Control vs Power
// Power =>   4 CR / power
// Control => 50 control / CPU. 25 CR/CPU => 2 CR / control

screepsProfiler.enable();
var loop = function () {
    screepsProfiler.wrap(function () {
        commonjsGlobal.Tmp = [];
        error_1.reset();
        if (Game.cpu.bucket < 50 && Game.shard.name != "shard1" && Game.time > 50){
            Log.error("Bucket too low");
            Game.notify(`Bucket hit minimum threshold at tick ${Game.time}`);
            return
        }

        if(Game.shard.name == "shard1" && Game.cpu.bucket == 10000){
            Game.cpu.generatePixel();
        }
        var localRooms = utils.splitRoomsByCity(); // only used for remote mining?
        var localCreeps = utils.splitCreepsByCity();
        var myCities = utils.getMyCities();
        let claimRoom, unclaimRoom;

        if(!Memory.gameState)
            city.setGameState();
        if(Memory.gameState < 4)
            city.runEarlyGame();

        // TODO add a setup function to validate memory etc
        if (!Memory.flags) Memory.flags = {};
        if(Game.time % 500 == 0){
            const f = Memory.flags;
            claimRoom = city.chooseClosestRoom(myCities,
                (f.claim && f.claimRally) || f.claim);
            unclaimRoom = city.chooseClosestRoom(myCities,
                (f.unclaim && f.unclaimRally) || f.unclaim);
            //em.expand() // grow the empire!
        }
        //run cities
        var prevCpu = Game.cpu.getUsed();
        for (let i = 0; i < myCities.length; i += 1) {
            try {
                if(Game.cpu.bucket - prevCpu < 10){
                    return
                }
                var city$1 = utils.getsetd(myCities[i].memory, "city", myCities[i].name + "0");
                const rcl = myCities[i].controller.level;
                const rclLimit =
                    settings_1.bucket.colony - rcl * settings_1.bucket.rclMultiplier;
                if (rcl < 8 && Game.cpu.bucket < rclLimit && Game.gcl.level > 1) {
                    continue // skip this city
                }
                city.runCity(city$1, localCreeps[city$1]);
                city.updateCountsCity(city$1, localCreeps[city$1] || [], localRooms[city$1], 
                    claimRoom, unclaimRoom);
                city.runTowers(city$1);
                // TODO: obs runs in dead cities
                observer.run(city$1);
                const currentCpu = Game.cpu.getUsed();
                stats.cityCpuMap[city$1] = currentCpu - prevCpu;
                prevCpu = currentCpu;
            } catch (failedCityError) {
                error_1.reportError(failedCityError);
            }
            
        }
        //run power creeps
        _.forEach(Game.powerCreeps, function(powerCreep$1) {
            powerCreep.run(powerCreep$1);
        });

        //gather homeless creeps
        if(Game.time % 50 == 1){
            _.forEach(Game.creeps, function(creep) {
                if(!creep.memory.role){
                    creep.memory.role = creep.name.split("-")[0];
                }
                if(!creep.memory.city){
                    creep.memory.city = "homeless";
                    creep.memory.target = 0;
                }
            });
        }

        //run homeless creeps (1 tick delay)
        if(localCreeps["homeless"]){
            const allRoles = roles.getRoles();
            const nameToRole = _.groupBy(allRoles, role => role.name);
            _.forEach(localCreeps["homeless"], (creep) => {
                nameToRole[creep.memory.role][0].run(creep);
            });
        }

        //clear old creeps
        if (Game.time % 100 === 0) {
            for (const name in Memory.creeps) {
                if (!Game.creeps[name]) {
                    delete Memory.creeps[name];
                }
            }
        }
        //clear rooms
        if (Game.time % 5000 === 0) {
            for (const name in Memory.rooms) {
                if (!Memory.rooms[name].city) {
                    delete Memory.rooms[name];
                }
            }
        }

        markets_1.manageMarket(myCities);

        if (Game.time % settings_1.roomplanTime == settings_1.roomplanOffset || (Game.time % 10 == 0 && Game.time < 20000 && Game.cpu.bucket > 1000)){
            roomplan.buildConstructionSites(); 
        }// TODO: this could go in run city?

        observer.recordRoomData();
        if(Game.time % settings_1.scouting.assessTime == 0) observer.findRoomsForScan();
        if(Game.time % settings_1.cMTime == settings_1.cMOffset && !PServ){//run commodity manager every 400 (lower than lowest batched reaction time, on the 39 so it'll be before dormant period ends)
            if(Game.time % settings_1.cMTime * 20 == settings_1.cMOffset){
                commodityManager.cleanCities(myCities);
            } else {
                commodityManager.runManager(myCities);
            }
        }

        if(Game.time % settings_1.flagCleanup) utils.cleanFlags();

        if(Game.cpu.bucket == 10000){
            //TODO: visuals should be its own file
            if(Cache.roomData){
                for(const roomName of Object.keys(Cache.roomData)){
                    const roomInfo = Cache.roomData[roomName];
                    if(roomInfo.controllerPos){
                        const pos = roomInfo.controllerPos;
                        Game.map.visual.circle(new RoomPosition(pos.x,pos.y,pos.roomName), {fill: "#FF0000", radius: 2});
                    }
                    if(roomInfo.sourcePos && roomInfo.sourcePos.length){
                        for(const pos of roomInfo.sourcePos){
                            Game.map.visual.circle(new RoomPosition(pos.x,pos.y,pos.roomName), {fill: "#00FF00", radius: 2});
                        }
                    }
                    if(roomInfo.rcl){
                        Game.map.visual.text(roomInfo.rcl, new RoomPosition(25,15,roomName), {color: "#00FF00", fontSize: 10});
                    }
                    if(roomInfo.score){
                        Game.map.visual.text(roomInfo.score, new RoomPosition(25,35,roomName), {color: "#00FF00", fontSize: 10});
                    }
                }
            }
        }

        // disable emailing
        utils.silenceCreeps();

        stats.collectStats(myCities);
        
        if (Game.time % settings_1.profileFrequency == 0) {
            Game.profiler.profile(settings_1.profileLength);
        }

        // burn extra cpu if the bucket is filling too quickly
        bucket.manage();

        // This will always be last. Throw an exception if any city failed.
        error_1.finishTick();
    });
};

var main = {
	loop: loop
};

exports['default'] = main;
exports.loop = loop;
