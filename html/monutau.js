
var graph_colors = [30,46,28,6,7,5,4,42,41,2,3,10,49,1,33,40,37,32,29,20,21,22,23,24,25,26,27,28,29,31,32,33,34,35]; 

var header_vars = ["event_number","trig_number","buffer_length","pretrigger_samples","readout_time", "readout_time_ns", "trig_time","raw_approx_trigger_time","raw_approx_trigger_time_nsecs","triggered_beams","beam_power","buffer_number","gate_flag","trigger_type","sync_problem"]; 



function checkModTime(file, callback)
{

  var req = new XMLHttpRequest(); 
  req.open("HEAD",file);
  req.send(null); 
  req.onload = function() 
  {
    if (req.status == 200) 
    {
      callback(req.getResponseHeader('Last-Modified'));
    }
    else callback(req.status); 
  }
}

function updateRunlist() 
{
  var xhr = new XMLHttpRequest() ;
  xhr.open('GET','runlist.json?'+Date.now()); 
  xhr.onload = function() 
  {
    if (xhr.status == 200) 
    {
      json = JSON.parse(xhr.response); 
      runs = json.runs; 
      document.getElementById('last_updated').innerHTML= json.last_updated; 
    }
  }
  xhr.send() 
}


function optClear()
{
  document.getElementById('opt').innerHTML = ""; 
}

function optAppend(str)
{
  document.getElementById('opt').innerHTML += str; 
}

function hashParams(what) 
{

  var pars = {}; 
  var hash = window.location.hash.split("&"); 

  if (hash[0].substring(1) != what) return pars; 
  
  for (var i = 0; i < hash.length; i++)
  {
    var idx =hash[i].indexOf("="); 
    if (idx > 0) 
    {
      pars[hash[i].substr(0,idx)]=hash[i].substr(idx+1); 
    }
  }

  return pars; 
}




function prettyPrintHeader(vars) 
{
  str = ""; 

  str += "<table><tr>"; 
  str += "<td>Event number: " + vars["header.event_number"] +"</td>"; 
  str += "<td>Trigger number: " + vars["header.trig_number"] +"</td>"; 
  str += "<td>Readout time : " + new Date(parseInt(vars["header.readout_time"])*1000 + parseInt(vars["header.readout_time_ns"])/1e6).toISOString() +"</td>"; 
  var run = parseFloat(vars["header.event_number"])/1e9;  
  if (run > 737) 
  {
	  str += "<td>Approx Trigger Time time : " + new Date(parseInt(vars["header.raw_approx_trigger_time"])*1000 + parseInt(vars["header.raw_approx_trigger_time_nsecs"])/1e6).toISOString() +"</td></tr>"; 
  }

  var isRF = parseInt(vars["header.trigger_type"]) == 2; 
  var isExt = parseInt(vars["header.trigger_type"]) == 3; 

  str += "<tr><td>Trigger type: " + ( isRF ? "RF" : isExt ? "EXT" :  "FORCE") + "</td>"
  var triggered_beams = Math.log2(parseInt(vars["header.triggered_beams"])); 
  str += "<td>Triggered beam: " + (isRF? triggered_beams : "N/A") +"</td>"; 
  str += "<td>Triggered beam power: " + (isRF ? vars["header.beam_power"] : "N/A") + "</td>"; 
  str += "<td>Raw TrigTime: " +vars["header.trig_time"]+"</td></tr>"; 
  str += "</table> "; 
    
  return str; 

}


function plotHelp()
{
  alert("Plot Help:\nDifferent plots are separated by line returns. Different lines on same plot are separated by |||.\nAfter ;;;, you may add additional options\n\txtitle=string\n\tytitle=string\n\txtime=0|1\n\tytime=0|1\n\tlabels=label1,label2,label3,etc."); 
}

function transferHelp()
{
  alert("If checked (default), will fully download all ROOT files before making plots. Otherwise, will use partial transfers, which might be faster, but I think results in additional bandwidth and might defeat browser cache... maybe."); 
}

function arrNonZero(arr) 
{
  for (var i = 0; i < arr.length; i++)
  {
    if (arr[i]) return true; 
  }

  return false; 
}

var navg = 0; 



/** Gets the power spectrum of a TGraph, returning as a TGraph. Optionally will upsample in fourier space */ 
function spec(g, upsample=1, envelope = null) 
{

  var Y = RF.upsample(g,upsample); 
  var G = RF.makePowerSpectrum(g, Y); 

  if (envelope != null) 
  {
    RF.hilbertEnvelope(g, Y, null, envelope);
  }

  return G; 
}





var pages = {}; 

function setGraphHistStyle(histo) 
{
    histo.fXaxis.fTitleSize = 0.05; 
    histo.fYaxis.fTitleSize = 0.05; 
    histo.fXaxis.fLabelSize = 0.045; 
    histo.fYaxis.fLabelSize = 0.045; 
//    histo.fXaxis.fTitleColor = 30;
//    histo.fYaxis.fTitleColor = 30; 
//    histo.fXaxis.fLabelColor = 30;
//    histo.fYaxis.fLabelColor = 30; 
    histo.fYaxis.fAxisColor = 11; 
    histo.fXaxis.fAxisColor = 11; 
    histo.fBits = histo.fBits | JSROOT.TH1StatusBits.kNoStats;
}

function Page(name)
{
  console.log("Made new page " + name); 
  P = new Object; 
  P.main_canvas = name+"c"; 
  document.getElementById('main').innerHTML += '<div id="'+P.main_canvas+'" style="display: none" width="100%" height=100%"> </div>'; 
  P.page_name = name; 
  P.canvases = []; 
  P.graphs = [];  
  P.envs = [];  
  P.leg_graphs = [];  
  P.multigraphs = []; 
  P.legends = []; 
  P.wants = []; 
  P.labels =[]; 
  P.xtitles = []; 
  P.ytitles = []; 
  P.titles = []; 
  P.xtime = []; 
  P.ytime = []; 
  P.pstyle = []; 
//  console.log(P); 
  return P; 
}

// persist some things... 
function clearCanvases(p, nuke=false)
{
  for (var i = 0; i < p.canvases.length; i++) 
  {
      JSROOT.cleanup(p.canvases[i]); 
  }

  p.graphs = []; 
  p.envs = []; 
  p.leg_graphs = []; 
  p.wants = [];  
  p.multigraphs = []; 
  p.xtitles = []; 
  p.ytitles = []; 
  p.xtime = []; 
  p.ytime = []; 
  p.labels = []; 
  p.pstyle = []; 
  p.legends = []; 
  p.titles = []; 

  if (nuke) 
  {
    p.canvases =[]; 
    var c = document.getElementById(p.main_canvas); 
    c.innerHTML = ""; 
  }
}

function addCanvas(P,cl='canvas',show_name = true) 
{
  var i = P.canvases.length+1; 
  var name = P.page_name+"_c" + i; 
  var c = document.getElementById(P.main_canvas); 
  var show = show_name ? name : ''; 
  c.innerHTML += '<div class="'+cl+'" id="' + name + '">'+show+'</div>'; 
  P.canvases.push(name); 
  return name; 
}



function startLoading(str = "Loading...") 
{
  document.getElementById("load").innerHTML = str; 
}
function appendLoading(str) 
{
  document.getElementById("load").innerHTML += str; 
}

function stopLoading() 
{
  document.getElementById("load").innerHTML = ""; 
}



function makeLegend(xlow,xhigh,ylow,yhigh, objs) 
{
      var leg = JSROOT.Create("TLegend"); 
      leg.fName="legend";
      leg.fTitle="Legend"; 
      leg.fX1NDC = xlow;
      leg.fX2NDC = xhigh; 
      leg.fY1NDC = ylow;
      leg.fY2NDC = yhigh; 
      leg.fFillStyle=1001; 
      leg.fFillColor=14; 
      leg.fNColumns = objs.length > 12 ? 4 : objs.length > 8 ? 3 : objs.length > 3 ? 2 : 1; 
 
      for (var i = 0; i < objs.length; i++) 
      {
        var entry = JSROOT.Create("TLegendEntry"); 
        entry.fObject=objs[i]; 
        entry.fLabel=objs[i].fTitle; 
        entry.fOption="l"; 
        leg.fPrimitives.arr.push(entry); 
      }
     
      return leg; 

}


function doDraw(page, ts, what,cut) 
{

  clearCanvases(page); 
  var plots = document.getElementById(what).value.split("\n"); 

  //clear out any null trees 
  var real_ts = []; 
  for (var it = 0; it < ts.length; it++)
  {
    if (ts[it] != null && ts[it].fEntries > 0) real_ts.push(ts[it]); 
  }


  for (var i = 0; i < plots.length; i++) 
  {
    //see if we have titles and time displays
    
    var these_plots = plots[i].split(";;;"); 



    var draws = these_plots[0].split("|||"); 
    var this_xtitle = ""; 
    var this_ytitle = ""; 
    var this_label = []; 
    var this_xtime = false; 
    var this_ytime = false; 
    var this_pstyle = "lp"; 
    var this_title = "Plot "+i; 

    if (these_plots.length > 1) 
    {

      var kvs = these_plots[1].split(";"); 
      for (var k = 0; k < kvs.length; k++)
      {
        var kv = kvs[k].split(":"); 

        if (kv[0].trim()==="xtitle")
        {
          this_xtitle = kv[1].trim(); 
        }
        if (kv[0].trim()==="title")
        {
          this_title = kv[1].trim(); 
        }
 
        if (kv[0].trim()==="ytitle")
        {
          this_ytitle = kv[1].trim(); 
        }
        if (kv[0].trim()==="labels")
        {
          this_label = kv[1].trim().split(","); 
        }
        if (kv[0].trim()==="xtime")
        {
          this_xtime = parseInt(kv[1].trim()); 
        }
        if (kv[0].trim()==="ytime")
        {
          this_ytime = parseInt(kv[1].trim()); 
        }
        if (kv[0].trim()==="opt")
        {
          this_pstyle = kv[1].trim(); 
        }
      }

    }

    page.xtitles.push(this_xtitle); 
    page.titles.push(this_title); 
    page.ytitles.push(this_ytitle); 
    page.labels.push(this_label); 
    page.xtime.push(this_xtime); 
    page.ytime.push(this_ytime); 
    page.pstyle.push(this_pstyle); 


    page.graphs.push([]); 
    page.leg_graphs.push([]); 
    if (page.canvases.length <= i) addCanvas(page); 
    var howmanytrees = 0; 
    var min_tt = ts.length -1; 

    page.wants.push(draws.length*real_ts.length); 

    for (var j = 0; j < draws.length; j++) 
    {
      for (var it = 0; it < real_ts.length; it++)
      {

        args = { expr: draws[j], cut: cut, graph: true, drawopt: [i,j,it]}; 
        real_ts[it].Draw(args, function(g,indices,ignore)
        {
          var ii = indices[0]; 
          var jj = indices[1]; 
          var tt = indices[2]; 

          if (g.fNpoints == 0) 
          {
            page.wants[ii]--; 
            return;
          }
          g.InvertBit(JSROOT.BIT(18)); 
          g.fTitle = page.labels[ii][jj]; 
          g.fName = page.labels[ii][jj]; 
          g.fLineColor = graph_colors[jj]; 
          g.fMarkerColor = graph_colors[jj]; 
          g.fFillColor = graph_colors[jj]; 
          page.graphs[ii].push(g); 
          if (tt == 0) 
          {
            page.leg_graphs[ii].push(g); 
          }
          if (page.graphs[ii].length == page.wants[ii]) 
          {
            var mg = JSROOT.CreateTMultiGraph.apply(0,page.graphs[ii]); 
            mg.fTitle = page.titles[ii]; 
            JSROOT.draw(page.canvases[ii],mg,"A" +page.pstyle[ii], function (painter) 
              {
                var hist = painter.firstpainter.GetHisto(); 
                hist.fXaxis.fTitle=page.xtitles[ii]; 
                hist.fYaxis.fTitle=page.ytitles[ii]; 
                if (page.xtime[ii])
                {
                  hist.fXaxis.fTitle += " (start = " + new Date(hist.fXaxis.fXmin*1000.).toISOString() + ")"; 
                }
                if (page.ytime[ii])
                {
                  hist.fYaxis.fTitle += " (start = " + new Date(hist.fYaxis.fXmin*1000.).toISOString() + ")"; 
                }
 
                var date = new Date(Date.now()); 
                hist.fYaxis.fTimeDisplay=page.ytime[ii]; 
                hist.fXaxis.fTimeDisplay=page.xtime[ii]; 
                hist.fYaxis.fTimeFormat="%F1970-01-01 " +date.getTimezoneOffset()/60 +":00:00s0" ;
                hist.fXaxis.fTimeFormat="%F1970-01-01 " +date.getTimezoneOffset()/60 +":00:00s0" ;
                JSROOT.redraw(painter.divid,hist,"", function (painter) 
                  {
                    if (page.labels[ii].length)
                    {
                      var leg = makeLegend(0.7,1,0.9,1,page.leg_graphs[ii]); 
                      JSROOT.draw(painter.divid,leg);
                      page.legends.push(leg); 
                    }
                  }); 
              }
            ); 
            page.multigraphs.push(mg); 
          }
        }); 
      }
    }
  }
}


function statusTreeDraw()
{
  var cut = document.getElementById('status_cut').value; 
  var run0 = parseInt(document.getElementById('status_start_run').value); 
  var run1 = parseInt(document.getElementById('status_end_run').value); 

  var decimated = document.getElementById('status_use_decimated').checked ? ".decimated" : "" 
  window.location.hash = "status&run0=" + run0 + "&run1=" + run1; 

  var status_trees = []; 

  startLoading("[Loading status files... be patient if you asked for a lot of runs]"); 

  var suffix = document.getElementById('status_full_transfers').checked ? "+" : ""; 
  var files_to_load = [];

  for (var r = run0; r <= run1; r++)
  {
    files_to_load.push("rootdata/run"+r+"/status"+decimated+".root"+suffix); 
  }

//  console.log(files_to_load); 

  for (var i = 0; i < files_to_load.length; i++)
  {
    JSROOT.OpenFile(files_to_load[i], function(file)
    {  
       appendLoading("="); 
       if (file == null)
       { 
         status_trees.push(null); 
         appendLoading("+"); 
         if (status_trees.length == files_to_load.length) 
         {
            stopLoading(); 
            doDraw(pages['status'],status_trees,'plot_status',cut); 
         }
 
         return; 
       }

       file.ReadObject("status;1", function(tree) 
       {
          status_trees.push(tree); 
          appendLoading("+"); 
          if (status_trees.length == files_to_load.length) 
          {
             stopLoading(); 
             doDraw(pages['status'],status_trees,'plot_status',cut); 
          }
       }); 
    }) ; 
  }
}


function hkTreeDraw() 
{
  var cut = document.getElementById('hk_cut').value; 
  if (cut != "") cut+= "&&"; 
  var t0 = new Date(document.getElementById('hk_start_time').value); 
  var t1 = new Date(document.getElementById('hk_end_time').value); 
  var t2 = new Date(t1.getTime() + 24* 3600 * 1000); 
  cut += "(hk.unixTime>" + t0.getTime()/1000 + "&&hk.unixTime<" + t1.getTime()/1000 + ")"; 

  window.location.hash = "hk&t0=" + t0.getTime() + "&t1=" + t1.getTime(); 

  //figure out what days we need 

  var hktrees = []; 

  var suffix = document.getElementById('hk_full_transfers').checked ? "+" : ""; 
  startLoading("[Loading hk files]"); 
  var files_to_load = []; 
  for (var d = new Date(t0); d<= t2; d.setDate(d.getDate()+1)) 
  {
    var mon = d.getUTCMonth()+1; 
    var day = d.getUTCDate(); 
    if (mon < 10) mon = "0" + mon; 
    if (day < 10) day = "0" + day; 
    files_to_load.push("rootdata/hk/" + d.getUTCFullYear()  + "/" + mon + "/" + day+ ".root"+suffix); 
  }
//  console.log(files_to_load); 

  for (var i = 0; i < files_to_load.length; i++)
  {

    JSROOT.OpenFile(files_to_load[i], function(file)
    { 
       appendLoading("="); 
       if (file == null)
       { 
         hktrees.push(null); 
         appendLoading("+"); 
         if (hktrees.length == files_to_load.length) 
         {
             stopLoading(); 
             doDraw(pages['hk'],hktrees,'plot_hk',cut); 
         }

         return; 
       }
       file.ReadObject("hk;1", function(tree) 
       {
       appendLoading("+"); 
          hktrees.push(tree); 
          if (hktrees.length == files_to_load.length) 
          {
             stopLoading(); 
             doDraw(pages['hk'],hktrees,'plot_hk',cut); 
          }
       }); 
    }) ; 
  }
}



function hk() 
{

  optAppend("Start Time: <input id='hk_start_time' size=30> ");
  optAppend("Stop Time: <input id='hk_end_time' size=30> " ); 
  optAppend("Cut: <input id='hk_cut' size=20 value='Entry$%10==0'>");
  optAppend(" | Full xfers(<a href='javascript:transferHelp()'>?</a>) : <input type=checkbox id='hk_full_transfers' checked> <br>" ); 
  optAppend("Plot(<a onClick='return plotHelp()'>?</a>):<br>");
  optAppend("<textarea id='plot_hk' cols=160 rows=5>hk.unixTime:hk.temp_board|||hk.unixTime:hk.temp_adc;;;xtitle:time;title:Temperatures;ytitle:C;xtime:1;labels:board,adc\n"
            +"hk.unixTime:hk.frontend_current|||hk.unixTime:hk.adc_current|||hk.unixTime:hk.aux_current|||hk.unixTime:hk.ant_current;;;xtitle:time;ytitle:mA;labels:frontend,adc,aux,ant;xtime:1;title:currents\n"
            +"hk.unixTime:hk.inv_batt_V|||hk.unixTime:hk.cc_batt_V|||hk.unixTime:hk.pv_V|||hk.unixTime:hk.cc_daily_Ah;;;title:Power;xtitle:time;ytitle:V or Ah;labels:Inverter Batt. Voltage,CC Batt. Voltage, PV Voltage,Daily Charge;xtime:1\n"
            +"hk.unixTime:hk.disk_space_kB;;;title:disk;xtitle:time;xtime:1;labels:disk;ytitle:kB</textarea>");
  optAppend("<br><input type='button' onClick='return hkTreeDraw()' value='Draw'>"); 
  optAppend("<a href='all_hk.root'>  (Download All HK ROOT File)</a>"); 
  
  var now = Date.now(); 

  var hash_params = hashParams('hk'); 

  document.getElementById('hk_start_time').value = new Date( hash_params['t0'] === undefined ? Date.now()- 7*24*3600*1000 : parseInt(hash_params['t0'])).toISOString(); 
  document.getElementById('hk_end_time').value = new Date(hash_params['t1'] === undefined ? Date.now() : parseInt(hash_params['t1'])).toISOString(); 

  hkTreeDraw(); 

} 

the_ffts = [];

ngraphs = 0; 
max_graphs = 8; 
last_run = -1; 
last_hd_tree = null; 
last_ev_tree = null; 
last_hd_modified= 0; 
last_ev_modified = 0; 


hd_canvas = null;
graph_canvases = []; 
fft_canvas = null;

//interferometry canvases 
int_canvas_h = null ; 
int_canvas_v = null;


boresight = [1,0,0]; 
max_phi = 180; 
max_theta = 90.0; 

h_antennas = [
  RF.Antenna( 0,0,0, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna( -30.46323775, -12.52208649,   4.46999022, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna(  -9.60219054, -46.82872785,  -0.67713143, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna( -30.58041715, -42.17715115,  13.79782586, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
 ]; 

v_antennas = [
  RF.Antenna( 0,0,0, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna( -30.64956888, -12.54918813,   5.82636563, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna( -10.0159635 , -46.86937298,  -1.43651148, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
, RF.Antenna( -30.3944812 , -42.53609774,  13.95834976, boresight[0],boresight[1],boresight[2], max_phi, max_theta)
 ]; 



h_mapper = RF.AngleMapper(h_antennas); 
v_mapper = RF.AngleMapper(v_antennas); 


nbinsx = 180; 
nbinsy = 90; 

h_map = null;
v_map = null; 




first_int = true; 

function drawMaxes(where, hist, n=3, min_distance =15)
{
  var maxes = []; 

  for (var imax = 0; imax < n; imax++) 
  {
    var max = 0; 
    var max_x = 0; 
    var max_y = 0; 

    for (var i = 1; i <= hist.fXaxis.fNbins; i++) 
    {
      for (var j = 1; j <= hist.fYaxis.fNbins; j++) 
      {
        var val = hist.getBinContent(i,j); 

        if (val > max) 
        {
          var x = hist.fXaxis.GetBinCenter(i);
          var y = hist.fYaxis.GetBinCenter(j);
          if (maxes.length > 0) 
          {
            var too_close = false; 

            //check that we're not too close to a max

            for (var iimax = 0; iimax< maxes.length; iimax++) 
            {
              var xdiff = maxes[iimax].x-x; 
              if (xdiff > 180) xdiff = 360-xdiff; 
              if (xdiff < -180) xdiff = 360+xdiff; 
              if (Math.pow(xdiff,2) + Math.pow(maxes[iimax].y-y,2) < min_distance*min_distance)
              {
                too_close = true; 
                break; 
              }
            }

            if (too_close) continue; 
          }

          max = val; 
          max_x = x; 
          max_y = y; 
   
        }

     }
    }

    var this_max= { x: max_x, y: max_y, max: max};
    maxes.push(this_max); 
    var R = 2.5*(n-imax); 

//    console.log(max_x, max_y, R); 

    var ell = JSROOT.Create("TObject"); 
    JSROOT.Create("TAttFill",ell); 
    JSROOT.Create("TAttLine",ell); 
    JSROOT.Create("TEllipse",ell); 
    ell.fLineColor = 3;
    ell.fLineStyle = 1;
    JSROOT.extend(ell, { fX1: max_x, fY1: max_y, fR1: R, fR2: R, fPhimin: 0, fPhimax: 360, fTheta:0}); 
    JSROOT.draw(where,ell); 
  }
}

the_h_graphs=[]; 
the_v_graphs=[]; 

coh_graphs = []; 
function drawCoherent(info) 
{
  var binx = info.binx; 
  var biny = info.biny; 
  var clicked_h = info.obj; 
  var x = clicked_h.fXaxis.GetBinCenter(binx);
  var y = clicked_h.fYaxis.GetBinCenter(biny);

  //make calculate the dts 

  var h_graphs= []; 
  var v_graphs= []; 

  var first = 0; 
  var h_times = []; 
  var v_times = []; 
  var h_names = []; 
  var v_names = []; 
  for (var i = 0; i < the_h_graphs.length; i++) 
  {
    if (the_h_graphs[i] != null) 
    {
      h_graphs.push(the_h_graphs[i]); 
      v_graphs.push(the_v_graphs[i]); 
      h_names.push("HPol " + i); 
      v_names.push("VPol " + i); 
      if (h_times.length == 0) 
      {
        first = i; 
      }
      var reverse_sign = document.getElementById('map_reverse').checked; 
      var sign = reverse_sign ? 1 : -1; 
	
      h_times.push(first == i ? 0 : sign*h_mapper.deltaTs(i,first,x,y)); 
      v_times.push(first == i ? 0 : sign*v_mapper.deltaTs(i,first,x,y)); 
    }
  }

  if (h_graphs.length > 0) 
  {
    if (document.getElementById("click_coh").checked) 
    {
      var gh= RF.sumWithDelays(h_graphs,h_times); 
      var gv= RF.sumWithDelays(v_graphs,v_times); 
      gh.fTitle = "Coherent HPol"; 
      gv.fTitle = "Coherent VPol"; 
      gh.fLineColor = 38; 
      gh.fMarkerColor = 38; 
      gv.fLineColor = 44; 
      gv.fMarkerColor = 44; 

      var all_graphs = [gh,gv]; 
      var mg = JSROOT.CreateTMultiGraph.apply(0,all_graphs);
      mg.fTitle = "#phi = "+ x + " , #theta = " + y; 
      showOverlay("[ Coherent Sum]"); 

      JSROOT.draw("overlay_c",mg, "alp", 
          function(p) 
          {
            var hist = p.firstpainter.GetHisto(); 
            hist.fXaxis.fTitle="ns"
            hist.fYaxis.fTitle="sum adu"
            JSROOT.redraw(p.divid, hist,"", function(p)
            {
              var leg = makeLegend(0.7,1,0.9,1, [gh,gv]); 
              JSROOT.draw(p.divid,leg,"same"); 
            });
 
          });
    }
    else
    {
      
      make_shifted_copy = function(raw_graphs, times, names,upsample = 3) 
      {
        var out = []; 
        for (var i = 0; i < raw_graphs.length; i++) 
        {
          var gg = JSROOT.CreateTGraph(raw_graphs[i].fNpoints, raw_graphs[i].fX.slice(0), raw_graphs[i].fY.slice(0)); 
          RF.upsample(gg, upsample+1); 
          RF.shiftTimes(gg, times[i]); 
          gg.fTitle = names[i]; 
          gg.fLineColor = graph_colors[i];
          gg.fMarkerColor = graph_colors[i]; 
          gg.InvertBit(JSROOT.BIT(18)); 
          out.push(gg); 
        }
        return out;
      }

      var shift_h_graphs = make_shifted_copy(h_graphs,h_times,h_names);
      var shift_v_graphs = make_shifted_copy(v_graphs,v_times,v_names);


      showOverlay("[ Aligned HPol, VPol ]"); 
      document.getElementById("overlay_c").innerHTML="<div class='half_v'  id='aligned_h'></div><div class='half_v' id='aligned_v'></div>"; 

      var hmg = JSROOT.CreateTMultiGraph.apply(0,shift_h_graphs);
      hmg.fTitle = "HPol #phi = "+ x + " , #theta = " + y; 
      JSROOT.draw("aligned_h",hmg, "alp", 
          function(p) 
          {
            var hist = p.firstpainter.GetHisto(); 
            hist.fXaxis.fTitle="ns"
            hist.fYaxis.fTitle="adu"
            JSROOT.redraw(p.divid,hist,"", function(p)
                {
                  var leg = makeLegend(0.7,1,0.9,1, shift_h_graphs); 
                  JSROOT.draw(p.divid,leg,"same"); 
                });
          });
      var vmg = JSROOT.CreateTMultiGraph.apply(0,shift_v_graphs);
      vmg.fTitle = "VPol #phi = "+ x + " , #theta = " + y; 
      JSROOT.draw("aligned_v",vmg, "alp", 
          function(p) 
          {
            var hist = p.firstpainter.GetHisto(); 
            hist.fXaxis.fTitle="ns"
            hist.fYaxis.fTitle="adu"

            JSROOT.redraw(p.divid,hist,"", function(p)
                {
                  var leg = makeLegend(0.7,1,0.9,1, shift_v_graphs); 
                  JSROOT.draw(p.divid,leg,"same"); 
                });
          });

    }
  }
}


function xcorr_style(g) 
{
  g.fLineColor = graph_colors[0]; 
  g.fMarkerColor = graph_colors[0]; 
}

var xcorrs_max_delay = 200; 

function update_max_dt()
{
  xcorrs_max_delay = parseInt(document.getElementById('xc_max_delay').value); 
  show_xcorrs();

}

function show_xcorrs() 
{
  showOverlay(" [ HPol XCorrs]  max_dt: <input size=5 id='xc_max_delay' value=" + xcorrs_max_delay+ " onChange='update_max_dt()'> [ VPol XCorrs ] "  ); 
  document.getElementById("overlay_c").innerHTML = "<div id='left_c' class='half'></div><div id='right_c' class='half'></div>"; 
  JSROOT.AssertPrerequisites("hierarchy", function() 
  {
    h_map.drawXCorrs("left_c", xcorr_style,xcorrs_max_delay); 
    v_map.drawXCorrs("right_c", xcorr_style,xcorrs_max_delay); 
  }
  );
}


function go(i) 
{
  var P = pages['event']; 
   
  if (i < 0)
  {
    i = parseInt(document.getElementById('evt_entry').value); 
  }
  else
  {
    document.getElementById('evt_entry').value = i; 
  }

  var run = parseInt(document.getElementById('evt_run').value); 

  if (runs.indexOf(run) < 0) 
  {
    alert("No run " + run); 
    return; 
  }

  window.location.hash = "event&run=" + run + "&entry=" + i; 

  var event_file = "rootdata/run" + run + "/event.root"; 
  var load_div = document.getElementById('load'); 
  load_div.innerHTML = '<a href="'+event_file+'">Event File</a>'; 
  var head_file = "rootdata/run" + run + "/header.root"; 
  load_div.innerHTML += ' | <a href="'+head_file+'">Head File</a>'; 
  var status_file = "rootdata/run" + run + "/status.root"; 
  load_div.innerHTML += ' | <a href="'+status_file+'">Status File</a>'; 
  load_div.innerHTML += ' | <a id="dl_link" href="data:text/csv;charset=utf-8">Event CSV</a> '

  var dl_link = document.getElementById("dl_link"); 

  csvContent = "data:text/csv;charset=utf-8,"; 

  ngraphs =0; 
  if (run!=last_run) 
  {
    last_hd_tree = null;
    last_ev_tree = null;
    last_hd_modified = "";
    last_ev_modified = "";
    last_run = run; 
  }


  /* Set up the canvases */ 


  if (P.canvases.length < 1) 
  {
    hd_canvas = addCanvas(P,"canvas_short",false); 
  }

  hd_canvas = P.canvases[0]; 


  for (var ii = 0; ii < max_graphs; ii++) 
  {
    if (P.canvases.length < ii+2) 
    {
      addCanvas(P, "canvas_small",false); 
    }
    graph_canvases[ii] = P.canvases[ii+1]; 
  }



  var int_h_index = graph_canvases.length+1;
  var int_v_index = graph_canvases.length+2;

  if (P.canvases.length < int_h_index+1) 
  {
    addCanvas(P,"canvas_small",false); 
    first_int = true;
  }

  if (P.canvases.length < int_v_index+1) 
  {
    addCanvas(P,"canvas_small",false); 
  }


  int_canvas_h = P.canvases[int_h_index]; 
  int_canvas_v = P.canvases[int_v_index]; 


  var fft_index = graph_canvases.length +3;

  if (P.canvases.length < fft_index+1) 
  {
    addCanvas(P,"canvas_med",false); 
  }

  fft_canvas = P.canvases[fft_index]; 


  // set up the interferometer


  //closure for processing header tree
    head_proc = function(tree) 
    {
        if (tree.fEntries <= i) 
        {
          i = tree.fEntries-1; 
          document.getElementById('evt_entry').value = i; 
          pause(); 
        }

        last_hd_tree = tree; 

        dl_link.setAttribute("download",run+"_"+i+".csv"); 


        var sel = new JSROOT.TSelector(); 

        for (var b = 0; b < header_vars.length; b++) 
        {
          sel.AddBranch("header."+header_vars[b]);     
        }
        

        sel.Begin = function ()
        {
        }

        sel.Process = function ()
        { 
          var hdrc = document.getElementById(hd_canvas); 

          /*
          var str = ""; 
          //todo, format nicer 
          
          str += "<table>"; 
          for (var b = 0; b < header_vars.length; b++) 
          {
            if ( b % 3 == 0) str += "<tr>"; 
            str += "<td>"+ header_vars[b] + ": </td> <td> " + this.tgtobj["header."+header_vars[b]] + "</td>"; 
            if ( b % 3 == 2) str += "</tr>"; 
          }
          str += "</table>"; 
          */
          hdrc.innerHTML = prettyPrintHeader(this.tgtobj);  
        }; 

        sel.Terminate = function(res) { ; } 

        var args = { numentries: 1, firstentry : i} ;
        tree.Process(sel, args); 
      }

    checkModTime(head_file, function(time)
        {
          if (last_hd_tree && time == last_hd_modified) 
          {
            head_proc(last_hd_tree); 
          }
          else
          {
            last_hd_modified=time; 
            JSROOT.OpenFile(head_file, function(file)  
            {
              if (file == null) 
              { 
                alert("Could not open event file!"); 
                return; 
              }

              file.ReadObject("header", head_proc); 

            }); 
          }

        });



    ev_proc = function(tree) 
    {
      last_ev_tree = tree;
      if (tree.fEntries <= i) 
      {
        i = tree.fEntries-1; 
        document.getElementById('evt_entry').value = i; 
        pause(); 
      }

      var sel = new JSROOT.TSelector(); 

      sel.AddBranch("event.event_number"); 
      sel.AddBranch("event.raw_data"); 
      sel.AddBranch("event.buffer_length"); 

      sel.Begin = function (){ }  ; 
      sel.Process = function ()
      { 
        var data = this.tgtobj['event.raw_data']; 
        var ev = this.tgtobj['event.event_number']; 
        var N = this.tgtobj['event.buffer_length']; 


        var X = []; 
        var ii = 0; 
        for (var x = 0; x < N; x++) { X.push(x*2) }; 
        var do_fft = document.getElementById('evt_fft').checked; 
        var do_envelope = document.getElementById('evt_hilbert').checked; 
        var do_measure = document.getElementById('evt_measure').checked; 
        var do_avg = document.getElementById('avg_fft').checked; 
        var upsample = document.getElementById('upsample').value; 
        var autoscale = document.getElementById('evt_autoscale').checked; 
        var run = ev / 1e9; 

        for (var ch = 0; ch < data.length; ch++)
        {
          if (!arrNonZero(data[ch])) continue; 

          var c = graph_canvases[ii]; 

          if (P.graphs.length > ii) JSROOT.cleanup(c); //not our first rodeo 

          ngraphs++; 

          var g= JSROOT.CreateTGraph(N, X, data[ch]); 

          for (var y = 0; y < N; y++) 
          { 
            g.fY[y]-=64;
            if (run > 1500 && run < 2000 && ch==7) 
            {
              g.fY[y] *=-1 ;
            }
          } 
          if (document.getElementById('filt').checked) 
          {
            var As = document.getElementById('filt_A').value.split(','); 
            var Bs = document.getElementById('filt_B').value.split(','); 

            var a = []; 
            var b = [];

            for (var jj =0; jj < As.length; jj++) 
            {
              a[jj] = parseFloat(As[jj]) 
            }
            for (var jj =0; jj < Bs.length; jj++) 
            {
              b[jj] = parseFloat(Bs[jj]) 
            }

            RF.IIRFilter(g,b,a); 

          }

          g.fTitle = " Evt" + ev + ", CH " + ch; 
          g.fLineColor = graph_colors[0]; 
          g.fMarkerColor = graph_colors[0]; 
          g.InvertBit(JSROOT.BIT(18)); 
          g.fName="g_c"+ch; 

          env = null; 

          if (do_envelope && do_fft) 
          {
            env = JSROOT.CreateTGraph(0,[],[]); 
            env.fLineColor = graph_colors[4]; 
            env.fMarkerColor = graph_colors[4]; 
            env.fTitle = "Envelope" 
            env.fName = "envelope" 
          }

          P.graphs[ch]=g; 
          P.envs[ch]=env; 

          if (do_measure)
          {
            var sum = 0; 
            var sum2 = 0; 

          }

          if (do_fft) 
          {
            var fft =  spec(g,upsample, do_envelope ? env : null); 
            if (do_avg && navg > 0) 
            {
               if (ii ==0) navg++; 

               for (var ff = 0; ff < the_ffts[ii].fNpoints; ff++)
               {
                 the_ffts[ii].fY[ff] =  10 * Math.log10((Math.pow(10, the_ffts[ii].fY[ff]/10) * (navg-1) + Math.pow(10, fft.fY[ff]/10)) / (navg)); 
               }

            }
            else
            {
              navg = do_avg ? 1 : 0; 
              the_ffts[ii] =fft; 
              the_ffts[ii].fLineColor = graph_colors[ii]; 
              the_ffts[ii].fMarkerColor = graph_colors[ii]; 
            }
          }

          csvContent += g.fY.join(",") + "\r\n"

          var min=9999; 
          var max=-9999; 
          var sum2 = 0; 
          var sum = 0;

          if (autoscale || do_measure) 
          {
            for (var y = 0; y < g.fY.length; y++) 
            {
                if (g.fY[y] < min) min = g.fY[y]; 
                if (g.fY[y] > max) max = g.fY[y]; 

                if (do_measure)
                {
                  sum2 += g.fY[y]*g.fY[y]; 
                  sum += g.fY[y]; 
                }
            }

          }
          var delta = max-min;
          var pave = null; 

          if (do_measure) 
          {
            var avg = sum / g.fNpoints; 
            var rms = Math.sqrt(sum2 / g.fNpoints - avg * avg); 

            pave =  JSROOT.Create("TPaveText"); 
            pave.fTitle="measurements"; 
            pave.fName="measure"; 
            pave.fLineStyle = 0; 
            pave.fTextSize = 12; 
            pave.fX1NDC=0.1; 
            pave.fX2NDC=0.9; 
            pave.fY1NDC=0.1; 
            pave.fY2NDC=0.3; 
            pave.AddText("max: " + max.toFixed(3) + "  min: " + min.toFixed(3) + "  Vpp: " + delta.toFixed(3)); 
            pave.AddText("avg: " + avg.toFixed(3) + "  rms: " + rms.toFixed(3)); 
            pave.fLines.arr[0].fTextColor = 5; 
            pave.fLines.arr[1].fTextColor = 5; 
            P.legends[ii] = pave; 
          }


          if (!autoscale)
          {
            var range = parseInt(document.getElementById('evt_zoom').value); 
            min= -range; 
            max= range; 
          }
          else
          {
            max +=0.1*delta; 
            min -=0.1*delta;
          }

          var histo = JSROOT.CreateHistogram("TH1I",100); 
          histo.fName = g.fName + "_h";
          histo.fTitle = g.fTitle;
          histo.fXaxis.fXmin = 0;
          histo.fXaxis.fXmax = N*2;;
          histo.fYaxis.fXmin = min;
          histo.fYaxis.fXmax = max;
          histo.fMinimum = min;
          histo.fMaximum = max;
          histo.fXaxis.fTitle = "ns"; 
          histo.fYaxis.fTitle = "adu"; 
          setGraphHistStyle(histo); 
          
          g.fHistogram = histo; 

          JSROOT.draw(c,g,"AL", function(painter)
              {
                var hist = painter.GetObject().fHistogram; 
                painter.root_pad().fGridx = 1; 
                painter.root_pad().fGridy = 1; 
                var tpainter = painter.FindPainterFor(null,"title"); 
                var pavetext = tpainter.GetObject(); 
//                pavetext.fTextColor = 31; 

                tpainter.Redraw(); 
                JSROOT.redraw(painter.divid, hist, ""); 
              }); 

          if (do_envelope && do_fft) 
          {
            JSROOT.draw(c,env, "LSAME"); 
          }

          if (do_measure) 
          {
            JSROOT.draw(c,pave,"SAME"); 
          }

          ii++; 
        }
      }; 

      sel.Terminate = function(res) 
      { 
        /* hide any extra channels */ 

        for (var ii = ngraphs; ngraphs < graph_canvases.length; ii++)
        {
            if (document.getElementById(graph_canvases[ii])) document.getElementById(graph_canvases[ii]).style.display = 'none'; 
        }

        if (document.getElementById('map').checked) //interferometry
        {

          if (h_map == null)
          {
              h_map = new RF.InterferometricMap(h_mapper,nbinsx,-180,180,nbinsy,-90,90); 
              v_map = new RF.InterferometricMap(v_mapper,nbinsx,-180,180,nbinsy,-90,90); 
          }


          if (document.getElementById('map_crop').checked)
          {
            h_map.setTimeRange(
                parseFloat(document.getElementById('map_tmin').value), 
                parseFloat(document.getElementById('map_tmax').value) ); 
            v_map.setTimeRange(
                parseFloat(document.getElementById('map_tmin').value), 
                parseFloat(document.getElementById('map_tmax').value) ); 
          }
          else
          {
            h_map.unsetTimeRange();
            v_map.unsetTimeRange();
          }

          h_map.setFreqRange(parseFloat(document.getElementById("map_fmin").value),
                            parseFloat(document.getElementById("map_fmax").value));

          v_map.setFreqRange(parseFloat(document.getElementById("map_fmin").value),
                            parseFloat(document.getElementById("map_fmax").value));




          var mask = parseInt(document.getElementById('map_mask').value); 
          //var cutoff = parseFloat(document.getElementById('map_cutoff').value); 
         // if (isNaN(cutoff)) cutoff = 0;
          //h_map.cutoff = cutoff; 
//          v_map.cutoff = cutoff; 

          var h_graphs = new Array(4) 
          var v_graphs = new Array(4) 
 //         console.log(mask); 

          for (var ii = 0; ii < 4; ii++)
          {
//            console.log(mask & (1 << ii)); 
            if (mask & (1<<ii))  
            {
              h_graphs[ii] = P.graphs[2*ii] ;
              v_graphs[ii] = P.graphs[2*ii+1]; 
            }
            else
            {
              h_graphs[ii] = null;
              v_graphs[ii] = null;
            }

          }

          the_h_graphs = h_graphs;
          the_v_graphs = v_graphs;

          setOffsets(); 

          var avg_map =document.getElementById('map_avg').checked; 

	  var reverse = document.getElementById('map_reverse').checked; 
          h_map.compute(h_graphs,avg_map,reverse);
          v_map.compute(v_graphs,avg_map,reverse);

          h_map.setTitle(avg_map ? "HPol (navgs=" + h_map.navg+")" : "HPol","azimuth (deg)","elevation (deg)"); 
          v_map.setTitle(avg_map ? "VPol (navgs=" + v_map.navg+")" : "VPol","azimuth (deg)","elevation (deg)"); 


          if (first_int) 
          {
            first_int = false
          }
          else
          {
            JSROOT.cleanup(int_canvas_h);
            JSROOT.cleanup(int_canvas_v);
          }

          setGraphHistStyle(h_map.hist); 
          setGraphHistStyle(v_map.hist); 

          var int_fn = function(painter) 
          {
                var tpainter = painter.FindPainterFor(null,"title"); 
                var pavetext = tpainter.GetObject(); 
                var pal = painter.FindFunction("TPaletteAxis"); 

                drawMaxes(painter.divid, painter.GetObject(), parseInt(document.getElementById('map_nmax').value)); 

                painter.ConfigureUserClickHandler(drawCoherent); 


//                pal.fAxis.fLabelColor = 31; 
 //               painter.Redraw(); 
//                pavetext.fTextColor = 31; 
//                tpainter.Redraw(); 
 
          }

         // console.log(h_map.hist); 
          JSROOT.draw(int_canvas_h,h_map.hist,  "colz",int_fn); 
          JSROOT.draw(int_canvas_v,v_map.hist,  "colz",int_fn); 
        }
        else
        {
          if (!first_int); 
          {
            JSROOT.cleanup(int_canvas_h);
            JSROOT.cleanup(int_canvas_v);
          }


        }


        if (document.getElementById('evt_fft').checked) 
        {

          var c = fft_canvas;
          document.getElementById(c).style.display = 'block'; 
          if (P.multigraphs.length) JSROOT.cleanup(c); 


          var mg = JSROOT.CreateTMultiGraph.apply(0, the_ffts); 
          P.multigraphs[0] = mg; 
          mg.fName="power"; 
          mg.fTitle = "Power Spectra" ; 
          if (navg > 0) mg.fTitle += " (" + navg + "avgs)"; 
          var histo = JSROOT.CreateHistogram("TH1I",100); 
          histo.fName = mg.fName + "_h";
          histo.fTitle = mg.fTitle;
          histo.fXaxis.fXmin = 0;
          histo.fXaxis.fXmax = 0.25; 
          histo.fYaxis.fXmin = -30;
          histo.fYaxis.fXmax = 60;
          histo.fMinimum = -30;
          histo.fMaximum = 60;
          histo.fXaxis.fTitle = "f (GHz)"; 
          histo.fYaxis.fTitle = "db ish"; 
          histo.fYaxis.fTitleOffset = 0.5; 
          setGraphHistStyle(histo); 
          mg.fHistogram = histo; 
          dl_link.setAttribute("href",encodeURI(csvContent)); 
 
          JSROOT.draw(c, mg, "ALP", function (painter) 
          {


                var leg = makeLegend(0.6,1,0.75,1,the_ffts); 
                var tpainter = painter.FindPainterFor(null,"title"); 
                var pavetext = tpainter.GetObject(); 
//                pavetext.fTextColor = 31; 
                tpainter.Redraw(); 

   
                JSROOT.draw(painter.divid,leg);
                P.legends[0] = leg; 
           }); 
         }
        else
        {
          document.getElementById(fft_canvas).style.display = 'none'; 
        }
      }

      var args = { numentries: 1, firstentry : i} ;
      tree.Process(sel, args); 
    }; 

    checkModTime(event_file, function(time)
    {
          if (last_ev_tree && time == last_ev_modified) 
          {
            ev_proc(last_ev_tree); 
          }
          else
          {
            last_ev_modified=time; 
            JSROOT.OpenFile(event_file, function(file)  
            {
              if (file == null) 
              { 
                alert("Could not open event file!"); 
                return; 
              }

              file.ReadObject("event", ev_proc); 

            }); 
          }

    });





}

function previous() 
{
  var i =parseInt(document.getElementById('evt_entry').value); 
  if (i > 0) i--; 
  go(i); 
}

function next() 
{
  var i =parseInt(document.getElementById('evt_entry').value); 
  go(i+1); 
}

var playing = false; 

function pause()
{

  document.getElementById('play_button').disabled = false; 
  document.getElementById('pause_button').disabled = true; 
  playing = false; 
}


function start()
{
  document.getElementById('play_button').disabled = true; 
  document.getElementById('pause_button').disabled = false; 
  playing = true; 
  next(); 
  setTimeout(function() { if (playing) { start(); } } , document.getElementById('play_speed').value); 
}


function evt() 
{
  optAppend("Run: <input id='evt_run' size=5 onchange='go(-1)'> "); 
  optAppend("Entry: <input id='evt_entry' value='0' size=10 onchange='go(-1)'> "); 
  optAppend(" | <input type='button' value='&#x22A2;' onClick='go(0)' title='Go to first event'>"); 
  optAppend("<input type='button' value='&larr;' onClick='previous()' title='Previous event'>"); 
  optAppend("<input type='button' id='pause_button' value='&#x25a0;' onClick='pause()' disabled title='Pause playing'>"); 
  optAppend("<input type='button' id='play_button' value='&#x25b6;' onClick='start()' title='Play through events'>"); 
  optAppend("<input type='button' value='&rarr;' onClick='next()' title='Next event'>"); 
  optAppend("<input type='button' value='&#x22A3;' onClick='go(100000000)' title='Last event'>"); 
  optAppend(" &Delta;t<sub>&#x25b6;</sub>:<input type='range' class='slider'  value='500' min='50' max='5000' id='play_speed'  title='Play speed' >"); 
  optAppend(" | Z: <input type='range' value='64' min='4' max='84' id='evt_zoom' class='slider' title='Manual scale'  onchange='go(-1)'> "); 
  optAppend(" auto<input type='checkbox' id='evt_autoscale' onchange='go(-1)'>"); 
  optAppend(" | spec?<input type='checkbox' id='evt_fft' checked title='Compute power spectrum (necessary for upsampling)' onchange='go(-1)'>");
  optAppend("avg?<input type='checkbox' id='avg_fft' title='Check to average fft's (uncheck to reset)' onchange='go(-1)'>");
  optAppend(" up<input type='range' value='1' min='1' max ='8' class='slider'   id='upsample' onchange='go(-1)' title='upsample factor'>"); 
  optAppend(" | env?<input type='checkbox' id='evt_hilbert' title='Compute Hilbert Envelope (requires spectrum))' onchange='go(-1)'>");
  optAppend(" | meas?<input type='checkbox' id='evt_measure' title='Perform measurements' onchange='go(-1)'>");
  optAppend(" | filt?<input type='checkbox' id='filt' title='Apply filter' onchange='go(-1)'> b:<input id='filt_B' size=15 title='Filter B coeffs (Comma separated)' value='1,6,15,20,15,6,1'> a:<input id='filt_A' title='Filter A coeffs (Comma separated)' size=15 value='64'>"); 
  optAppend(" | map?<input type='checkbox' checked id='map' title='Do interferometric map' onchange='go(-1)'> avg? <input id='map_avg' type='checkbox' onchange='go(-1)'>");
  optAppend(" <input id='showcfg' type='button' value='cfg' title='configure maps' onclick='showMapConfig()'>"); 
  optAppend("  <input id='xc_button' type='button' value='xc'title='show xcorrs' onclick='show_xcorrs()' > "); 
  optAppend(" coh: <input id='click_coh' type=checkbox title='Show coherent waveforms when clicking on map' size=5 checked'>"); 
//  optAppend(" cutoff: <input id='map_cutoff' title='frequency cutoff for cross-correlations' size=5 value='0'>"); 


  var hash_params = hashParams('event'); 
  document.getElementById('evt_run').value = hash_params['run']===undefined ? runs[runs.length-1]: hash_params['run']; 
  document.getElementById('evt_entry').value = hash_params['entry']===undefined ? '0' : hash_params['entry']; 
  go(-1); 
}

function spectrogram() 
{

  optAppend("<b>!!WARNING!!:</b> Generating spectrograms essentially requires downloading all the data in a run (since everything is processed client-side). Don't try this on a slow connection or metered data plan. Sometimes, the jsroot click/mouseover handlers don't seem to be applied properly (probably some weird internal timeout); clicking the redraw link will usually fix that.<br><br>"); 
  optAppend("Run: <input id='spec_run' size=5 value=''> | "); 

  var hash_params = hashParams('spectrogram'); 

  optAppend("Cut: <input id='spec_cut' size=40 value='header.trigger_type==1' > | "); 
  optAppend("Min: <input alt='minimum entry' id='spec_min' size=9' value='0' >"); 
  optAppend(" Max: <input alt='maximum entry' id='spec_max' size=9' value='-1' > | "); 
  optAppend("Nsecs: <input alt='width of time bin entry' id='spec_nsec' size=5' value='10' > | "); 
  optAppend("ChMask : <input alt='channel mask, or 0 for all' id='spec_mask' size=10' value='255' > | "); 


  optAppend("<input id='spec_compute' type='button' value='COMPUTE' onClick='makeSpectrogram()'>"); 

  if (hash_params['run'] == undefined) 
  {
    document.getElementById("spec_run").value = runs[runs.length-1] 
  }
  else
  {
    document.getElementById("spec_run").value = hash_params['run']; 
  }

}

var making_spectrogram = 0; 

function stopSpectrogram(text="") 
{
  making_spectrogram = 0; 
  document.getElementById("spec_compute").value="COMPUTE"; 
  document.getElementById("spec_compute").onclick=makeSpectrogram; 
  startLoading(text); 
}
function cancelSpectrogram() 
{

  stopSpectrogram("Cancelled (partial results may plot)"); 
}

function specPaintFn(painter) 
{
  var pal = painter.FindFunction("TPaletteAxis"); 
  pal.fX2NDC = 0.93; 
  painter.frame_painter().Zoom(0,0, 0.02, 0.08,0,0); 
}

function redrawSpecta() 
{
  var P = pages["spectrogram"]; 
  for (var i = 0; i < P.canvases.length; i++) 
  {
    JSROOT.cleanup(P.canvases[i]); 
    JSROOT.draw(P.canvases[i], P.graphs[i], "colz", specPaintFn); 
  }

}


function makeSpectrogram()
{
  document.getElementById("spec_compute").value="CANCEL"; 
  document.getElementById("spec_compute").onclick=cancelSpectrogram; 
  making_spectrogram=1; 

  run = parseInt(document.getElementById('spec_run').value); 
  window.location.hash = "spectrogram&run=" + run ; 
  clearCanvases(pages['spectrogram'], true); 
  startLoading("[figuring out what we need]") ;


  if (runs.indexOf(run) < 0) 
  {
    stopSpectrogram("No run " + run); 
    return; 
  }

  var hfile = "rootdata/run" + run + "/header.root"; 

  JSROOT.OpenFile(hfile, function(f) 
  {
    if (f == null) 
    {
      stopSpectrogram("Could not open head file"); 
      return; 
    }

    f.ReadObject("header", function (ht) 
    {
      var min = parseInt(document.getElementById("spec_min").value); 
      if (min < 0) min += ht.fEntries; 
      if (min < 0) min = 0; 
      if (min >= ht.fEntries) min = ht.fEntries-1; 

      var cut = "(" + document.getElementById("spec_cut").value+")" + " && ( Entry$ >= " + min +")"; 
      var max = parseInt(document.getElementById("spec_max").value); 
      if (max < 0) max += ht.fEntries; 
      if (max < 0) max = 0; 
      if (max >= ht.fEntries) max = ht.fEntries-1; 
      cut += " && ( Entry$ < " + max + ")"; 

      var args = { expr: "Entry$:header.readout_time+1e-9*header.readout_time_ns", cut: cut, graph: true};
      ht.Draw(args, function(g,blah1,blah2)
      {
        if (!making_spectrogram) return; 
        startLoading("[Processing 0/" + g.fNpoints + " entries ]"); 

        var i = 0; 
        var cut_i = 0; 
        var sel = new JSROOT.TSelector(); 
        sel.AddBranch("event.raw_data"); 
        sel.AddBranch("event.buffer_length"); 

        sel.Begin = function() { ; } 
        var chs = parseInt(document.getElementById("spec_mask").value); 

        var tmin = g.fY[0]; 
        var tmax = g.fY[g.fNpoints-1]; 
        var nsecs = parseFloat(document.getElementById("spec_nsec").value); 

        var nt = Math.ceil((tmax-tmin)/nsecs); 
//        console.log(nt); 
        tmax = nsecs * nt + tmin; 
//        console.log(tmin); 
//        console.log(tmax); 
        
        var specs = []; 

        sel.Process = function() 
        {
          if (!making_spectrogram || cut_i > g.fNpoints)
          {
            sel.Abort(); 
            return; 
          }
          if (g.fX[cut_i] > i++) return; 

          var data = this.tgtobj['event.raw_data']; 
          var N = this.tgtobj['event.buffer_length']; 

          for (var ch = 0; ch < data.length; ch++) 
          {
            if (chs && !(chs & ( 1 << ch))) 
            {
              specs[ch] = null; 
              continue; 
            }

            if (specs.length == 0 || (chs && specs.length <= ch))
            {
              specs.push(new RF.Spectrogram(chs==0 ?"All channels" : "Ch " + ch, nt, tmin,tmax, N/2+1, 0, 0.25)); 
            }

            var sp= chs == 0 ? specs[0] : specs[ch]; 
            var mn = RF.getMean(data[ch]); 
            var y = new Float32Array(data[ch].length); 
            for (var i = 0; i < y.length ;i++) y[i] = data[ch][i]-mn; 

            sp.addY( y, g.fY[cut_i]); 
          }
          cut_i++; 
//          console.log(cut_i, i); 

          if ( (cut_i  % Math.floor(g.fNpoints / 100) == 0) && making_spectrogram) startLoading("[Processing "+ cut_i + "/" + g.fNpoints + " entries ]"); 
        }

        sel.Terminate = function () {
         

          var ispec = 0;
          for (var i = 0; i < specs.length; i++) 
          {
            var s = specs[i]; 
            if (s == null) continue; 
            s.finalize(); 
            pages["spectrogram"].graphs[ispec++] = s.hist; 
            var c = addCanvas(pages["spectrogram"],"canvas_tall"); 
            JSROOT.draw(c, s.hist, "colz", specPaintFn);
          }

          if (making_spectrogram) 
            stopSpectrogram("Done"); 

          
          appendLoading(" <a href='javascript:redrawSpecta()'>[click to redraw] </a>"); 

        } ;

        var nentries = max-min+1;
//        console.log(nentries); 

        var sel_args = {numentries: nentries, firstentry: min }; 

        //now load the event tree, 
        var event_file = "rootdata/run" + run + "/event.root"; 
        
        JSROOT.OpenFile(event_file, function(ef) 
        {
          ef.ReadObject("event", function(et) 
          {
            et.Process(sel,sel_args); 
          });
        }); 

      });
    });
  }); 








}



function stat()
{

  optAppend("Start Run: <input id='status_start_run' size=10> ");
  optAppend("Stop Run: <input id='status_end_run' size=10> " ); 
  optAppend("Cut: <input id='status_cut' size=20 value=''>");
  optAppend(" | Full xfers(<a href='javascript:transferHelp()'>?</a>) : <input type=checkbox id='status_full_transfers' checked>  | Use decimated files<input type=checkbox id='status_use_decimated' checked><br>"); 
  optAppend("Plot(<a href='javascript:plotHelp()'><u>?</u></a>):<br>");

  var global_scalers= "status.readout_time+status.readout_time_ns*1e-9:status.global_scalers[2]";
  global_scalers += "|||status.readout_time+status.readout_time_ns*1e-9:status.global_scalers[1]/10";
  global_scalers += "|||status.readout_time+status.readout_time_ns*1e-9:status.global_scalers[0]/10";
  global_scalers += ";;;xtitle:time;title:Global Scalers;ytitle:Hz;xtime:1;labels:Fast,Slow Gated,Slow"

  var beam_scalers = ""; 
  for (var i = 0; i <20 ; i++)
  {
    if (i > 0) beam_scalers+="|||"; 
    beam_scalers+="status.readout_time+status.readout_time_ns*1e-9:status.beam_scalers[0]["+i+"]/10."; 
  }
  beam_scalers+=";;;xtitle:time;title:Beam Scalers;ytitle:Hz;xtime:1;labels:"; 
  for (var i = 0; i <20; i++)
  {
    if (i > 0) beam_scalers+=","; 
    beam_scalers+="Beam "+i; 
  }

  var beam_thresholds = ""; 
  for (var i = 0; i <20; i++)
  {
    if (i > 0) beam_thresholds+="|||"; 
    beam_thresholds+="status.readout_time+status.readout_time_ns*1e-9:status.trigger_thresholds["+i+"]"; 
  }
  beam_thresholds+=";;;xtitle:time;title:Trigger thresholds;ytitle:Power Sum(arb);xtime:1;labels:"; 
  for (var i = 0; i <20; i++)
  {
    if (i > 0) beam_thresholds+=","; 
    beam_thresholds+="Beam "+i; 
  }

  optAppend("<textarea id='plot_status' cols=160 rows=5>"+global_scalers+"\n"+beam_scalers+"\n"+beam_thresholds+"</textarea>");
  optAppend("<br><input type='button' onClick='return statusTreeDraw()' value='Draw'>"); 

  var hash_params = hashParams('status'); 
  document.getElementById('status_start_run').value =  hash_params['run0'] === undefined ? runs[Math.max(0,runs.length-8)] : parseInt(hash_params['run0']); 
  document.getElementById('status_end_run').value =  hash_params['run1'] === undefined ? runs[runs.length-1] : parseInt(hash_params['run1']); 

  statusTreeDraw(); 
}



function show(what) 
{
  playing = false; 
  if (making_spectrogram) stopSpectrogram("You moved to another page"); 

  optClear(); 

  for (var key in pages)
  { 
    document.getElementById(pages[key].main_canvas).style.display = (key === what ? 'block' : 'none');
  }

//  console.log("show('" + what + "')"); 
  if (what in pages)
    clearCanvases(pages[what]); 


  if (what == 'hk') 
  {
    hk(); 
  }
  else if (what == 'status') 
  {
    stat(); 
  }
  else if (what == 'event') 
  {
    evt(); 
  }
  else if (what == "spectrogram")
  {
    spectrogram(); 
  }
  else
  {
    optAppend("Not implemented yet");  
  }
}


function closeOverlay() 
{
  var overlay = document.getElementById("overlay"); 
  overlay.style.display = 'none'; 
  JSROOT.cleanup("overlay_c"); 
}

function showOverlay(title='Overlay Window')
{
  var overlay = document.getElementById("overlay"); 

  document.getElementById('overlay_title').innerHTML=title; 
  if (overlay.style.display == 'block')
  {
    JSROOT.cleanup("overlay_c"); 
  }


  overlay.style.display = 'block'; 
  return overlay; 
}



function monutau_load()
{



  JSROOT.gStyle.fTitleX=0.1; 
  JSROOT.gStyle.fFrameFillColor=12; 
  JSROOT.gStyle.fFrameLineColor=11; 
  JSROOT.gStyle.fTitleColor=3; 
  JSROOT.gStyle.fGridColor=11; 
  JSROOT.gStyle.fGridColor=11; 
  JSROOT.gStyle.Palette = 87; 
  JSROOT.gStyle.AutoStat=false; 
  JSROOT.gStyle.fNumberContours=255; 

  pages['hk'] = Page('hk'); 
  pages['status'] = Page('status'); 
  pages['event'] = Page('event'); 
  pages['spectrogram'] = Page('spectrogram'); 

  document.getElementById('last_updated').innerHTML = last_updated; 

  var hash = window.location.hash; 
  if (hash == '')
  {
    show('hk'); 
  }
  else 
  {
    show(hash.substring(1).split('&')[0]); 
  }
  setInterval(updateRunlist, 10e3); 
}

function showMapConfig() 
{
  // load in the actual values... 

  for (var ant = 0; ant <4; ant++) 
  {
    document.getElementById("hA"+ant+"_x").value = h_antennas[ant].pos[0];
    document.getElementById("hA"+ant+"_y").value = h_antennas[ant].pos[1];
    document.getElementById("hA"+ant+"_z").value = h_antennas[ant].pos[2];
    document.getElementById("vA"+ant+"_x").value = v_antennas[ant].pos[0];
    document.getElementById("vA"+ant+"_y").value = v_antennas[ant].pos[1];
    document.getElementById("vA"+ant+"_z").value = v_antennas[ant].pos[2];
  }
  document.getElementById("map_nphi").value = nbinsx;
  document.getElementById("map_ntheta").value = nbinsy;
  document.getElementById("mapconfig").style.display='block'
}

function hideMapConfig() 
{

  //save the antenna positions 
  for (var ant = 0; ant <4; ant++) 
  {
    h_antennas[ant].pos[0]= document.getElementById("hA"+ant+"_x").value  ;
    h_antennas[ant].pos[1]= document.getElementById("hA"+ant+"_y").value  ;
    h_antennas[ant].pos[2]= document.getElementById("hA"+ant+"_z").value  ;
    v_antennas[ant].pos[0]= document.getElementById("vA"+ant+"_x").value  ;
    v_antennas[ant].pos[1]= document.getElementById("vA"+ant+"_y").value  ;
    v_antennas[ant].pos[2]= document.getElementById("vA"+ant+"_z").value  ;
  }

  nbinsx = document.getElementById("map_nphi").value;
  nbinsy = document.getElementById("map_ntheta").value;

  //remake the maps
  h_map = new RF.InterferometricMap(h_mapper,nbinsx,-180,180,nbinsy,-90,90); 
  v_map = new RF.InterferometricMap(v_mapper,nbinsx,-180,180,nbinsy,-90,90); 

  go(-1); 
  document.getElementById("mapconfig").style.display='none'
}

function setOffsets() 
{
  if (document.getElementById('map_applyhoffs').checked) 
  {
    RF.shiftTimes(the_h_graphs[0], parseFloat(document.getElementById('offs_h0').value));
    RF.shiftTimes(the_h_graphs[1], parseFloat(document.getElementById('offs_h1').value));
    RF.shiftTimes(the_h_graphs[2], parseFloat(document.getElementById('offs_h2').value));
    RF.shiftTimes(the_h_graphs[3], parseFloat(document.getElementById('offs_h3').value));
  }

  if (document.getElementById('map_applyvoffs').checked) 
  {
    RF.shiftTimes(the_v_graphs[0], parseFloat(document.getElementById('offs_v0').value));
    RF.shiftTimes(the_v_graphs[1], parseFloat(document.getElementById('offs_v1').value));
    RF.shiftTimes(the_v_graphs[2], parseFloat(document.getElementById('offs_v2').value));
    RF.shiftTimes(the_v_graphs[3], parseFloat(document.getElementById('offs_v3').value));
  }


}



