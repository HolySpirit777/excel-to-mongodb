var express = require('express');
const app = express();
var bodyParser = require('body-parser');
var mongo = require('mongoose');
var cors = require('cors');
var Schema = mongo.Schema;

var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + '/public'));

//DATABASE

var db = mongo.createConnection("mongodb://localhost:27017/test", { useCreateIndex: true, useNewUrlParser: true });

//MONGOOSE

var PersonasSchema = new Schema({
    caso: {type: String},
    cedula: {type: String},
    direccion: {type: String},
    nombre: {type: String},
    nota: {type: String},
    fechaCreado: {type: Date}
}, { versionKey: false });

var CounterSchema = new Schema({
    _id: {type: String, required: true},
    seq: { type: Number, default: 0}
});

var UsuarioSchema = Schema({
    usuario: {type: String},
    contrasena: {type: String},
    nombre: {type: String},
    privilegio: {type: String},
    casos: {type: Array}
})

var usuario = db.model('Usuario', UsuarioSchema, "usuarios");
var counter = db.model('counter', CounterSchema);
var model = db.model('Persona', PersonasSchema);

async function incrementar() {
    let result = await counter.findByIdAndUpdate('incremento', {$inc: { seq: 1} }, {new: true});
    return result.seq
}

//EXCEL TO Json

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

                let resultDos = fs.readFile("./outPutJSON/output.json", 'utf8', async (err, fileContents) => {
                    if (err) {
                      console.error(err);
                      return;
                    }
                    try {
                      let data = JSON.parse(fileContents);
                      console.log(data + ' <--- This is what I want to check');
                      for(let cantidad = 0; cantidad < data.length; cantidad++){
                        var documento = data[cantidad];
                        if(documento.nombre === '' || documento.cedula === '' || documento.direccion === '') {
                            console.log('No se puede guardar este documento');
                        } else {
                            var mostrar = await incrementar();
                            documento.caso = mostrar;
                            documento.fechaCreado = Date.now();
                            var mod = new model(documento);
                            await mod.save(documento);
                        }
                      }
                    } catch(err) {
                      console.error(err);
                    }
                  })
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

//DATABASE

app.get('/archivo', function(req, res){
    res.sendFile(__dirname + "/index.html")
});

//SERVER

app.listen('3000', function(){
    console.log('running on 3000 port');
})
