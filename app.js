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

//REQUEST

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

  app.get('/usuario', function (req, res) {

    usuario.find(
        function (err, usuarios){
            if(err){
                console.log(err)
            }
            else{
                res.json(usuarios);
            }
        }
    )
  });

  app.get('/usuario-especifico/:value', function (req, res) {

    let value = req.params.value;
    usuario.findOne({usuario: value}, function (err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.json(doc);
        } 
    })

  });

  app.post('/agregarSinAsignar', async function(req, res) {
    
    for (const iterator of req.body) {
        var user = new model(iterator);
        await user.save(iterator);
    }

    res.json({ ok: true });
});
  
  app.post('/usuario-borrar/:usuario', function (req, res) {

      usuario.updateOne({usuario: req.params.usuario}, { $pullAll: {casos: req.body}}, function (err, raw) {
        if (err) {
            console.log(err);
        }else {
            console.log(raw)
            res.json({value: 'ok'});
        }
    });

  });


app.get('/buscarUsuario/:value', function (req, res) {
    let value = req.params.value;
    usuario.find({ usuario: value}, function(err, doc) {
        if(err) {
          console.log(err);
        }else {
            if (doc.length !== 0){
                res.json(doc);
            }else {
                res.json('No');
            }
            
            // console.log(doc);
        }
    });
});

app.get('/editar/:id', function (req, res) {
    let id = req.params.id;
    model.findById(id, function (err, persona){
        if(err) {
            console.log(err)
        }else{
            res.json(persona);
        }
    });
  });

//Se puede actualizar asi
app.post('/actualizar-usuario/:id', function (req, res) {

    usuario.findByIdAndUpdate(req.params.id, {nombre: req.body.nombre, usuario: req.body.usuario, contrasena: req.body.contrasena, privilegio: req.body.privilegio}, function (err, res){
        if(err) {
            console.log(err);
        } else {
            console.log(res);
        }
    })
});

//Se puede actualizar asi
app.post('/actualizar/:id', function (req, res) {
    model.findById(req.params.id, function(err, persona){
        if(err) {
            console.log(err);
        }
        if(!persona){
            res.status(404).send("Datos no encontrados");
        }
        else{
            persona.cedula = req.body.cedula;
            persona.direccion = req.body.direccion;
            persona.nombre = req.body.nombre;
            persona.nota = req.body.nota;

            persona.save().then(persona => {
                console.log("Los datos fueron actualizados");
            })
            .catch(err => {
                console.log("No se actualizaron los datos");
            });
        }
    });
});

app.post("/crearUsuario", function(req, res) {
    var user = new usuario(req.body);
    user.save();
    res.json({ ok: true });
});

app.post("/agregarCasos", async function(req, res){

            for (const iterator of req.body.list) {
                await usuario.updateOne({usuario: req.body.user},
                    { $push: {casos: iterator}}, {useFindAndModify: false});
                await model.deleteOne({cedula: iterator.cedula});
            }

            res.json({ ok: true });
});

app.post("/guardarUsuario", function(req, res){

    model.find({cedula: req.body.cedula}, async function (err, cedula){
        if(err){
            console.log(err);
        }else{
            if(cedula.length === 0){

                caso = req.body;
                var aumentoCaso = await incrementar();
                caso.caso = aumentoCaso;
                var mod = new model(req.body);

                mod.save()
                .then(persona => {
                    console.log("Los datos fueron guardados!");
                })
                .catch(err => {
                    console.log("No se pudieron guardar los datos!");
                });
            }else{
                console.log("Ya este documento existe en la base de datos");
            }
        }
    });
});


app.get("/borrarcaso/:id", function(req, res){
    model.findByIdAndRemove({ _id: req.params.id }, function(err) {
        if(err){
            console.log(err);
        }else{
            res.send({data:"El usuario ha sido eliminado"});
        }
    });
});

app.get("/borrarUsuario/:id", function(req, res){
    usuario.findByIdAndRemove({ _id: req.params.id }, function(err) {
        if(err){
            console.log(err);
        }else{
            res.json("Done");
        }
    });
});


//EXCEL TO JSON

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
                            console.log(documento.nombre + ' <--- ' + documento.caso);
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