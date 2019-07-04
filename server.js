var express = require('express');
const app = express();
var bodyParser = require('body-parser');
var path = require('path');
var mongo = require('mongoose');
var cors = require('cors');
const personasRoutes = express.Router();

var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
const fs = require('fs');

app.use(bodyParser());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));

//DATABASE

var db = mongo.connect("mongodb://localhost:27017/test", { useNewUrlParser: true }, function(err, response){
    if(err){
        console.log(err)
    }else{
        console.log('Conectado a ' + db);
    }
})

//MONGOOSE

var Schema = mongo.Schema;

var PersonasSchema = new Schema({
    cedula: {type: String},
    direccion: {type: String},
    nombre: {type: String}
}, { versionKey: false });

var model = mongo.model('Persona', PersonasSchema);

//REQUEST

//Obtener

app.get('/' ,function (req, res) {
    model.find(function (err, personas){
        if(err){
            console.log(err)
        }
        else{
            res.json(personas);
        }
    });
});

app.post("/guardarUsuario", function(req, res){
    console.log("Dentro!!!!");
    console.log(req.body);
    var mod = new model(req.body);
    mod.save()
    .then(persona => {
        console.log("Los datos fueron guardados!");
    })
    .catch(err => {
        console.log("No se pudieron guardar los datos!");
    });
});

//EXCEL TO JSON THEN SENT TO DATABASE

var storage = multer.diskStorage({
    destination: function (req, file, cb){
        cb(null, './uploads/')
    },
    filename: function (req, file, cb){
        var datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length -1])
    }
});

var upload = multer({
    storage: storage,
    fileFilter : function(req, file, callback) {
        if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length-1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

app.post('/upload', function(req, res){
    var exceltojson;
    upload(req, res, function(err){
        if (err) {
            res.json({error_code:1,err_desc:err});
            return;
        }
        if(!req.file){
            res.json({error_code:1, err_desc:"No file passed"});
            return;
        }

        if(req.file.originalname.split('.')[req.file.originalname.split('.').length-1] === 'xlsx'){
            exceltojson = xlsxtojson;
        } else {
            exceltojson = xlstojson;
        }
        try {
            exceltojson({
                input: req.file.path,
                output: "./outPutJSON/output.json",
                lowerCaseHeaders: true
            }, function(err, result){
                if(err){
                    return res.json({error_code:1, err_desc:err, data: null});
                }
                res.json({datos:"Los datos fueron agregados exitosamente"});
                //res.json({error_code:0, err_desc:null, data: result});

                let resultDos = fs.readFile("./outPutJSON/output.json", 'utf8', async (err, fileContents) => {
                    if (err) {
                      console.error(err)
                      return;
                    }
                    try {
                      let data = JSON.parse(fileContents)
                      console.log(data.length);

                      console.log(data);
                    //   model.create(data, function (err) {
                    //       if(err){
                    //           console.log(err);
                    //       }
                    //   });

                      for(let cantidad = 0; cantidad < data.length; cantidad++){
                        var documento = data[cantidad];
                        var mod = new model(documento);
                        console.log(documento);
                        await mod.save(documento);
                        // model.create(documento).save();
                      }
                    } catch(err) {
                      console.error(err);
                    }
                  })
                  console.log(resultDos);
                });
                var fs = require('fs');
                try {
                    fs.unlinkSync(req.file.path)
                }catch(e){

                }
        } catch (e) {
            res.json({error_code:1, err_desc:"Corrupted excel file"});
        }
    });
});

app.get('/archivo', function(req, res){
    res.sendFile(__dirname + "/index.html")
});

//SERVER

app.listen('3000', function(){
    console.log('running on 3000 port');
})
