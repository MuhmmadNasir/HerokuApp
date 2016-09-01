(function($){

$(document).ready(function(){

$('#block-devel-switch-user').css('cursor','pointer').click(function(){
   $('ul.links').slideToggle();

 });


      $('.field-items').on('mouseenter mouseleave',null,function(){
        $(this).toggleClass('hilight');
        }
      );



      // hover(,
      //   function(){
      //   $(this).removeClass('hilight');
      //   }
      //   );





 });

})(jQuery);


;
