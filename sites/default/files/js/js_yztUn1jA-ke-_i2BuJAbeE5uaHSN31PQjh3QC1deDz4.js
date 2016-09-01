(function($){

$(document).ready(function(){

$('#block-devel-switch-user').css('cursor','pointer').click(function(){
   $('ul.links').slideToggle();

 });


      $('.field-items').live('mouseenter mouseleave',function(){
        $(this).toggleClass('hilight');
        }
      );



      hover(,
        function(){
        $(this).removeClass('hilight');
        }
        );





 });

})(jQuery);


;
