"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pollutions_entity_1 = require("./entities/pollutions.entity");
const config_1 = require("@nestjs/config");
const stations_entity_1 = require("./entities/stations.entity");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const cron = __importStar(require("node-cron"));
const moment_1 = __importDefault(require("moment"));
const average_entity_1 = require("./entities/average.entity");
const grade_thresholds_type_1 = require("./type/grade-thresholds.type");
const sido_name_type_1 = require("./type/sido-name.type");
const city_entity_1 = require("./entities/city.entity");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
let MapService = class MapService {
    constructor(pollutionsRepository, stationsRepository, averageRepository, cityRepository, entityManager, configService, logger) {
        this.pollutionsRepository = pollutionsRepository;
        this.stationsRepository = stationsRepository;
        this.averageRepository = averageRepository;
        this.cityRepository = cityRepository;
        this.entityManager = entityManager;
        this.configService = configService;
        this.logger = logger;
        cron.schedule('*/1 * * * *', () => {
            this.saveAverage();
        });
    }
    hasNullValues(obj) {
        for (const key in obj) {
            if (obj[key] === null ||
                obj[key] === undefined ||
                obj[key] === '' ||
                obj[key] === '-' ||
                obj[key] === '통신장애') {
                return true;
            }
        }
        return false;
    }
    async fetchPollutionData() {
        this.logger.debug('start to fetch air pollution data');
        const serviceKey = this.configService.get('SERVICE_KEY');
        const returnType = 'json';
        const numOfRows = 661;
        const pageNo = 1;
        const sidoName = '전국';
        const ver = '1.0';
        const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?sidoName=${sidoName}&pageNo=${pageNo}&numOfRows=${numOfRows}&returnType=${returnType}&serviceKey=${serviceKey}&ver=${ver}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        else {
            throw new Error('Failed to fetch pollution data. api was not working.');
        }
    }
    async findStationWithPollution(stationName) {
        return await this.stationsRepository.findOne({
            where: { stationName },
            relations: {
                pollution: true,
            },
        });
    }
    async findStation(stationName) {
        return await this.stationsRepository.findOne({
            where: { stationName: stationName },
            select: ['id', 'stationName'],
        });
    }
    async fixData(value) {
        const fixedData = Number.parseFloat(value).toFixed(2);
        return fixedData.toString();
    }
    async savePollutionData(data) {
        this.logger.debug('start save pollution data.');
        try {
            const { dataTime, sidoName, stationName, pm10Value, pm10Grade, pm25Value, pm25Grade, no2Value, no2Grade, o3Value, o3Grade, so2Value, so2Grade, coValue, coGrade, } = data;
            const foundStation = await this.findStationWithPollution(stationName);
            this.logger.debug(`찾은 측정소: ${foundStation.id} : ${foundStation.stationName}`);
            if (!foundStation) {
                this.logger.debug(`등록된 ${stationName} 측정소가 없습니다.`);
                return;
            }
            else if (foundStation) {
                if (!foundStation.pollution) {
                    this.logger.debug(`새로운 ${foundStation.stationName} 측정소의 측정값을 추가합니다.`);
                    await this.pollutionsRepository.save({
                        stationId: foundStation.id,
                        dataTime,
                        sidoName,
                        stationName,
                        pm10Value,
                        pm10Grade,
                        pm25Value,
                        pm25Grade,
                        no2Value,
                        no2Grade,
                        o3Value,
                        o3Grade,
                        so2Value,
                        so2Grade,
                        coValue,
                        coGrade,
                    });
                }
                else {
                    this.logger.debug(`${foundStation.stationName} 측정소의 측정값을 업데이트 합니다.`);
                    await this.pollutionsRepository.update(foundStation.pollution.id, {
                        dataTime,
                        pm10Value,
                        pm10Grade,
                        pm25Value,
                        pm25Grade,
                        no2Value,
                        no2Grade,
                        o3Value,
                        o3Grade,
                        so2Value,
                        so2Grade,
                        coValue,
                        coGrade,
                    });
                }
            }
            return;
        }
        catch (e) {
            this.logger.error('failed to save pollution data');
            this.logger.verbose(e);
            throw e;
        }
    }
    async checkPollutionInformation() {
        this.logger.debug('start to fetch air pollution data');
        try {
            const data = await this.fetchPollutionData();
            for (const item of data.response.body.items) {
                this.logger.verbose(item);
                let { dataTime, sidoName, stationName, pm10Value, pm25Value, no2Value, o3Value, so2Value, coValue, } = item;
                const checkList = {
                    dataTime,
                    sidoName,
                    stationName,
                    pm10Value,
                    pm25Value,
                    no2Value,
                    o3Value,
                    so2Value,
                    coValue,
                };
                if (this.hasNullValues(checkList))
                    continue;
                pm10Value = await this.fixData(pm10Value);
                pm25Value = await this.fixData(pm25Value);
                no2Value = await this.fixData(no2Value);
                o3Value = await this.fixData(o3Value);
                coValue = await this.fixData(coValue);
                so2Value = await this.fixData(so2Value);
                const pm10Grade = await this.saveGrade('pm10', pm10Value);
                const pm25Grade = await this.saveGrade('pm25', pm25Value);
                const no2Grade = await this.saveGrade('no2', no2Value);
                const o3Grade = await this.saveGrade('o3', o3Value);
                const coGrade = await this.saveGrade('co', coValue);
                const so2Grade = await this.saveGrade('so2', so2Value);
                const newData = {
                    dataTime,
                    sidoName,
                    stationName,
                    pm10Value,
                    pm10Grade,
                    pm25Value,
                    pm25Grade,
                    no2Value,
                    no2Grade,
                    o3Value,
                    o3Grade,
                    so2Value,
                    so2Grade,
                    coValue,
                    coGrade,
                };
                await this.savePollutionData(newData);
                this.logger.debug('fetch and save pollution informations successfully');
            }
        }
        catch (e) {
            this.logger.error(`Faild to fetch pollution data`);
            this.logger.verbose(e);
        }
    }
    async saveDataToFile() {
        this.logger.debug('start to fetch air pollution data');
        try {
            const data = await this.fetchPollutionData();
            const fileName = (0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss');
            const filePath = path.join(process.cwd(), 'air_condition', `${fileName}.json`);
            const jsonData = JSON.stringify(data, null, 2);
            await fs_1.promises.writeFile(filePath, jsonData, 'utf8');
            this.logger.debug('save air condition data to file');
        }
        catch (error) {
            this.logger.error('failed to save air pollution datas to file', error);
        }
    }
    async fetchStationData() {
        this.logger.debug('start to fetch station informations');
        const pageNo = 1;
        const numOfRows = 1000;
        const returnType = 'json';
        const serviceKey = this.configService.get('SERVICE_KEY');
        const url = `http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList?&pageNo=${pageNo}&numOfRows=${numOfRows}&serviceKey=${serviceKey}&returnType=${returnType}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        else {
            throw new common_1.BadRequestException('응답 없음');
        }
    }
    async saveStations() {
        this.logger.debug('start to save station informations');
        try {
            const data = await this.fetchStationData();
            this.logger.debug(data);
            for (const item of data.response.body.items) {
                this.logger.verbose('station: ', item);
                const foundStation = await this.findStation(item.stationName);
                if (!foundStation) {
                    await this.stationsRepository.save({ ...item });
                    this.logger.debug(`새로운 ${item.stationName}을 업로드합니다.`);
                }
                else {
                    this.logger.debug(`${item.stationName}이 이미 존재합니다.`);
                    return;
                }
            }
        }
        catch (e) {
            this.logger.error('측정소 정보를 업데이트 할 수 없습니다.');
            throw e;
        }
    }
    async fetchAverage(sidoName) {
        this.logger.debug(`sido name: ${sidoName}`);
        const serviceKey = this.configService.get('SERVICE_KEY');
        const returnType = 'json';
        const url = `https://apis.data.go.kr/B552584/ArpltnStatsSvc/getCtprvnMesureSidoLIst?serviceKey=${serviceKey}&returnType=${returnType}&numOfRows=100&pageNo=1&sidoName=${sidoName}&searchCondition=HOUR`;
        const response = await fetch(url);
        if (response.ok) {
            console.log(response, url);
            const data = response.json();
            this.logger.verbose(data);
            return data;
        }
        else {
            this.logger.debug('응답 없음');
            return;
        }
    }
    async findCityInGuName(sidoName, guName) {
        const data = await this.cityRepository.find({
            where: [{ sidoName, guName }],
            select: { code: true },
        });
        if (data[0]) {
            return data;
        }
        else {
            return;
        }
    }
    async findCityInGunName(sidoName, gunName) {
        const data = await this.cityRepository.find({
            where: [{ sidoName, gunName }],
        });
        if (data[0]) {
            return data;
        }
        else {
            return;
        }
    }
    async saveNewAverageInfo(item, cityCodes, pm10Grade, pm25Grade, no2Grade, o3Grade, coGrade, so2Grade) {
        const data = await this.averageRepository.save({
            ...item,
            cityCodes,
            pm10Grade,
            pm25Grade,
            no2Grade,
            o3Grade,
            coGrade,
            so2Grade,
        });
        if (data) {
            return data;
        }
        else {
            return;
        }
    }
    async findAverageData(sidoName, cityName) {
        return await this.averageRepository.findOne({
            where: { sidoName, cityName },
        });
    }
    async updateAverageInfo(id, dataTime, sidoName, cityName, cityCodes, pm10Value, pm25Value, no2Value, o3Value, so2Value, coValue, pm10Grade, pm25Grade, no2Grade, o3Grade, coGrade, so2Grade) {
        return await this.averageRepository.update(id, {
            dataTime,
            sidoName,
            cityName,
            cityCodes,
            pm10Value,
            pm25Value,
            no2Value,
            o3Value,
            so2Value,
            coValue,
            pm10Grade,
            pm25Grade,
            no2Grade,
            o3Grade,
            coGrade,
            so2Grade,
        });
    }
    async saveAverage() {
        this.logger.debug('start to save average of city air pollution');
        try {
            for (let i = 0; i < sido_name_type_1.sidoName.length; i++) {
                setTimeout(async () => {
                    const data = await this.fetchAverage(sido_name_type_1.sidoName[i]);
                    for (const item of data.response.body.items) {
                        const { dataTime, sidoName, cityName, pm10Value, pm25Value, no2Value, o3Value, so2Value, coValue, } = item;
                        const checkList = {
                            dataTime,
                            sidoName,
                            cityName,
                            pm10Value,
                            pm25Value,
                            no2Value,
                            o3Value,
                            so2Value,
                            coValue,
                        };
                        const hasNull = this.hasNullValues(checkList);
                        if (hasNull)
                            continue;
                        const pm10Grade = await this.saveGrade('pm10', item.pm10Value);
                        const pm25Grade = await this.saveGrade('pm25', item.pm25Value);
                        const no2Grade = await this.saveGrade('no2', item.no2Value);
                        const o3Grade = await this.saveGrade('o3', item.o3Value);
                        const coGrade = await this.saveGrade('co', item.coValue);
                        const so2Grade = await this.saveGrade('so2', item.so2Value);
                        const foundData = await this.findAverageData(sidoName, cityName);
                        console.log(foundData);
                        if (foundData) {
                            const updatedData = await this.updateAverageInfo(foundData.id, dataTime, sidoName, cityName, foundData.cityCodes, pm10Value, pm25Value, no2Value, o3Value, so2Value, coValue, pm10Grade, pm25Grade, no2Grade, o3Grade, coGrade, so2Grade);
                            console.log('업데이트 된 항목: ', updatedData);
                        }
                        else {
                            let cities = await this.findCityInGuName(sidoName, cityName);
                            console.log('구 발견: ', cities);
                            if (!cities) {
                                cities = await this.findCityInGunName(sidoName, cityName);
                                console.log('군 발견, ', cities);
                            }
                            if (!cities) {
                                this.logger.verbose(`해당 city ${sidoName} ${cityName}를 table 에서 찾을 수 없습니다.`);
                                continue;
                            }
                            const codes = cities.map((city) => Number(city.code));
                            this.logger.verbose(`codes: ${codes}`);
                            const data = await this.saveNewAverageInfo(item, codes, pm10Grade, pm25Grade, no2Grade, o3Grade, coGrade, so2Grade);
                            if (!data) {
                                this.logger.error('평균값 데이터를 저장할 수 없습니다.');
                                continue;
                            }
                            console.log(data);
                        }
                    }
                }, i * 5000);
            }
        }
        catch (error) {
            this.logger.error(`failed to save average of city air pollution.`);
            this.logger.error(error);
        }
    }
    async saveGrade(type, value) {
        const thresholds = grade_thresholds_type_1.gradeThresholds[type];
        for (const grade in thresholds) {
            const { min, max } = thresholds[grade];
            if (value >= min && value <= max) {
                return grade;
            }
        }
        return '등급 없음';
    }
    async getPollutionInformation(dto) {
        this.logger.debug('start to get air pollution data');
        const { minLat, maxLat, minLng, maxLng } = dto;
        try {
            const rawQuery = `
        SELECT 
          p.*, 
          s.id as station_id,
          s.station_name,
          s.addr,
          s.dm_x,
          s.dm_y
        FROM 
          pollutions p 
        INNER JOIN 
          stations s 
        ON 
          p.station_id = s.id 
        WHERE 
          s.dm_x BETWEEN $1 AND $2 
          AND s.dm_y BETWEEN $3 AND $4
      `;
            const parameters = [minLat, maxLat, minLng, maxLng];
            const data = await this.entityManager.query(rawQuery, parameters);
            const list = [];
            const fixedAddr = data.map((d) => {
                const { station_name, sido_name, data_time, pm10_value, pm10_grade, pm25_value, pm25_grade, no2_value, no2_grade, o3_value, o3_grade, so2_value, so2_grade, dm_x, dm_y, } = d;
                const newData = {
                    station_name,
                    sido_name,
                    addr: d.addr.split(' ')[1],
                    data_time,
                    pm10_value,
                    pm10_grade,
                    pm25_value,
                    pm25_grade,
                    no2_value,
                    no2_grade,
                    o3_value,
                    o3_grade,
                    so2_value,
                    so2_grade,
                    dm_x: Number(dm_x),
                    dm_y: Number(dm_y),
                };
                list.push(newData);
            });
            this.logger.debug('get air pollution data successfully');
            return list;
        }
        catch (e) {
            this.logger.error('failed to get air pollution data.', { e });
            throw e;
        }
    }
    async getAverage() {
        this.logger.debug('start to get average of city air pollution data');
        try {
            const cityAverages = await this.averageRepository.find();
            let data = [];
            for (const cityAverage of cityAverages) {
                for (const cityCode of cityAverage.cityCodes) {
                    data.push({
                        cityCode: cityCode,
                        cityName: cityAverage.cityName,
                        sidoName: cityAverage.sidoName,
                        dataTime: cityAverage.dataTime,
                        pm10Grade: cityAverage.pm10Grade,
                        pm25Grade: cityAverage.pm25Grade,
                        no2Grade: cityAverage.no2Grade,
                        o3Grade: cityAverage.o3Grade,
                        coGrade: cityAverage.coGrade,
                        so2Grade: cityAverage.so2Grade,
                    });
                }
            }
            this.logger.debug('get average of city air pollution data successfully');
            return data;
        }
        catch (e) {
            this.logger.error('failed to get average of city air pollution data');
            throw e;
        }
    }
};
exports.MapService = MapService;
exports.MapService = MapService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pollutions_entity_1.Pollutions)),
    __param(1, (0, typeorm_1.InjectRepository)(stations_entity_1.Stations)),
    __param(2, (0, typeorm_1.InjectRepository)(average_entity_1.Average)),
    __param(3, (0, typeorm_1.InjectRepository)(city_entity_1.City)),
    __param(4, (0, typeorm_1.InjectEntityManager)()),
    __param(6, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.EntityManager,
        config_1.ConfigService,
        winston_1.Logger])
], MapService);
//# sourceMappingURL=map.service.js.map