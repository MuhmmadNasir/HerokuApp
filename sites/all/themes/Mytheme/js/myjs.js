(function($){

$(document).ready(function(){

$('#block-devel-switch-user').css('cursor','pointer').click(function(){
   $('ul.links').slideToggle();

 });


      $('.field-items').on('mouseenter mouseleave',null,function(){
        $(this).toggleClass('hilight');
        }
      );


$('.node-readmore a').click(function(){

var url = $(this).attr('href');
 var link = this;

  $.ajax({

    url: url ,
    success : function(data){
               var fullContent = $('#block-system-main .field-item:first' , data);
               var html = fullContent.html();
               $(link).parents('article.node').find('div.field-item').html(html);
               $(link).hide();
  }

  });
  return false;

}); //readmore Ajax







 }); //ready function closing

})(jQuery);


